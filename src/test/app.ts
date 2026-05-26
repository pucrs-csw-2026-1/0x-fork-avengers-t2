import Fastify from 'fastify'
import swaggerPlugin from '../plugins/swagger.plugin.js'
import schemasPlugin from '../plugins/schemas.plugin.js'
import { eventsRoutes } from '../routes/events.routes.js'

export async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(swaggerPlugin)
  await app.register(schemasPlugin)
  await app.register(eventsRoutes)
  await app.ready()
  return app
}
