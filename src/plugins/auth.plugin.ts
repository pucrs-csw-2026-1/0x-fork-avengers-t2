import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { env } from '../config/env.js'

interface JwtPayload {
  sub: string
  scopes: string[]
  principal_type: 'user' | 'service'
  exp: number
  email?: string
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${env.AUTH_SERVICE_URL}/.well-known/jwks.json`))
  }
  return jwks
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' })
    }

    const token = authHeader.slice(7)

    try {
      const { payload } = await jwtVerify<JwtPayload>(token, getJwks(), {
        algorithms: ['RS256'],
      })

      request.user = {
        id: payload.sub,
        scopes: payload.scopes ?? [],
        principalType: payload.principal_type,
      }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }
  })
}

export default fp(authPlugin, { name: 'auth' })

export function requireScope(...required: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const missing = required.some((s) => !request.user.scopes.includes(s))
    if (missing) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
