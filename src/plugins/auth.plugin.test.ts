import { describe, it, expect, beforeAll } from 'vitest'
import Fastify from 'fastify'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireScope } from './auth.plugin.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

// CryptoKey is a global Web Crypto API type available in Node.js 18+
let privateKey: CryptoKey
let publicJwk: Record<string, unknown>

beforeAll(async () => {
  const { privateKey: priv, publicKey: pub } = await generateKeyPair('RS256')
  privateKey = priv
  publicJwk = { ...(await exportJWK(pub)), kid: 'test-key-1', alg: 'RS256', use: 'sig' }
})

async function signToken(
  payload: Record<string, unknown>,
  options: { algorithm?: string; noExp?: boolean } = {}
): Promise<string> {
  const alg = options.algorithm ?? 'RS256'

  if (alg !== 'RS256') {
    // HS256 needs a symmetric key — use a fake one to produce an invalid-alg token
    const { createHmac } = await import('crypto')
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url')
    const sig = createHmac('sha256', 'secret').update(`${header}.${body}`).digest('base64url')
    return `${header}.${body}.${sig}`
  }

  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setSubject((payload.sub as string) ?? 'usr_test')
    .setIssuedAt()

  if (!options.noExp) {
    builder = builder.setExpirationTime('1h')
  }

  return builder.sign(privateKey)
}

function buildTestApp(jwksPayload: Record<string, unknown>): FastifyInstance {
  const app = Fastify({ logger: false })

  // inline auth plugin that uses the local JWKS instead of fetching remotely
  app.register(fp(async (fastify: FastifyInstance) => {
    const { createLocalJWKSet, jwtVerify } = await import('jose')
    const localJwks = createLocalJWKSet({ keys: [jwksPayload] })

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization

      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header' })
      }

      const token = authHeader.slice(7)

      try {
        const { payload } = await jwtVerify<{
          sub: string
          scopes: string[]
          principal_type: 'user' | 'service'
          type: 'access' | 'refresh'
        }>(token, localJwks, { algorithms: ['RS256'] })

        if (payload.type !== 'access') {
          return reply.status(401).send({ error: 'Invalid or expired token' })
        }

        request.user = {
          id: payload.sub,
          scopes: payload.scopes ?? [],
          principalType: payload.principal_type,
        }
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' })
      }
    })
  }, { name: 'auth-test' }))

  app.get('/me', async (req) => ({ user: req.user }))

  return app
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('auth plugin', () => {
  it('token válido → request.user preenchido corretamente', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const token = await signToken({
      sub: 'usr_abc123',
      scopes: ['participant', 'manager'],
      principal_type: 'user',
      type: 'access',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.id).toBe('usr_abc123')
    expect(body.user.scopes).toEqual(['participant', 'manager'])
    expect(body.user.principalType).toBe('user')

    await app.close()
  })

  it('token ausente → 401', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/me' })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('header sem Bearer → 401', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Token abc' },
    })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('token expirado → 401', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    // sign with iat in the past and expired exp
    const { privateKey: priv } = await generateKeyPair('RS256')
    const expiredToken = await new SignJWT({
      scopes: ['participant'],
      principal_type: 'user',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('usr_expired')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(priv)

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('token com algoritmo inválido (HS256) → 401', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const hs256Token = await signToken(
      { sub: 'usr_hs256', scopes: [], principal_type: 'user' },
      { algorithm: 'HS256' }
    )

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${hs256Token}` },
    })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('token com assinatura inválida → 401', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    // sign with a different key pair — signature won't match the JWKS
    const { privateKey: otherKey } = await generateKeyPair('RS256')
    const invalidToken = await new SignJWT({
      scopes: ['participant'],
      principal_type: 'user',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('usr_invalid')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherKey)

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${invalidToken}` },
    })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('refresh token (type=refresh) → 401', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const refreshToken = await signToken({
      sub: 'usr_abc',
      scopes: ['participant'],
      principal_type: 'user',
      type: 'refresh',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${refreshToken}` },
    })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('admin com scopes cumulativos → todos os scopes presentes', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const token = await signToken({
      sub: 'usr_admin',
      scopes: ['participant', 'manager', 'admin'],
      principal_type: 'user',
      type: 'access',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const { user } = res.json()
    expect(user.scopes).toContain('participant')
    expect(user.scopes).toContain('manager')
    expect(user.scopes).toContain('admin')

    await app.close()
  })

  it('principal_type service → principalType correto', async () => {
    const app = buildTestApp(publicJwk)
    await app.ready()

    const token = await signToken({
      sub: 'svc_gateway',
      scopes: ['participant'],
      principal_type: 'service',
      type: 'access',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().user.principalType).toBe('service')

    await app.close()
  })
})

// ── requireScope ──────────────────────────────────────────────────────────────

function buildScopeApp(userScopes: string[]): FastifyInstance {
  const app = Fastify({ logger: false })

  app.decorateRequest('user', null)
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.user = { id: 'usr_test', scopes: userScopes, principalType: 'user' }
  })

  app.post('/protected', { preHandler: requireScope('manager') }, async (_req, reply) => {
    reply.status(200).send({ ok: true })
  })

  app.post('/multi', { preHandler: requireScope('manager', 'admin') }, async (_req, reply) => {
    reply.status(200).send({ ok: true })
  })

  return app
}

describe('requireScope', () => {
  it('scope presente → 200', async () => {
    const app = buildScopeApp(['participant', 'manager'])
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/protected' })
    expect(res.statusCode).toBe(200)

    await app.close()
  })

  it('scope ausente → 403', async () => {
    const app = buildScopeApp(['participant'])
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/protected' })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'Forbidden' })

    await app.close()
  })

  it('scopes vazios → 403', async () => {
    const app = buildScopeApp([])
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/protected' })
    expect(res.statusCode).toBe(403)

    await app.close()
  })

  it('múltiplos scopes exigidos — todos presentes → 200', async () => {
    const app = buildScopeApp(['participant', 'manager', 'admin'])
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/multi' })
    expect(res.statusCode).toBe(200)

    await app.close()
  })

  it('múltiplos scopes exigidos — um faltando → 403', async () => {
    const app = buildScopeApp(['participant', 'manager'])
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/multi' })
    expect(res.statusCode).toBe(403)

    await app.close()
  })
})
