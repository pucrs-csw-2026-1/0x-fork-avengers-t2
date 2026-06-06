import Fastify from 'fastify'
import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createLocalJWKSet, jwtVerify } from 'jose'
import swaggerPlugin from '../plugins/swagger.plugin.js'
import schemasPlugin from '../plugins/schemas.plugin.js'
import { eventsRoutes } from '../routes/events.routes.js'

// Builds the app with a fixed mock user — no JWT required (used by non-auth tests)
export async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(swaggerPlugin)
  await app.register(schemasPlugin)

  app.addHook('onRequest', async (req) => {
    req.user = { id: 'usr_test', scopes: ['participant'], principalType: 'user' }
  })

  await app.register(eventsRoutes)
  await app.ready()
  return app
}

// Builds the app with real JWT validation against a local JWKS (no remote call)
export async function buildAppWithAuth(
  jwks: ReturnType<typeof createLocalJWKSet>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(swaggerPlugin)
  await app.register(schemasPlugin)

  await app.register(fp(async (fastify: FastifyInstance) => {
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
        }>(token, jwks, { algorithms: ['RS256'] })
        request.user = {
          id: payload.sub,
          scopes: payload.scopes ?? [],
          principalType: payload.principal_type,
        }
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' })
      }
    })
  }, { name: 'auth-local' }))

  await app.register(eventsRoutes)
  await app.ready()
  return app
}
