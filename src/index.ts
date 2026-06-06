import Fastify from 'fastify'
import swaggerPlugin from './plugins/swagger.plugin.js'
import schemasPlugin from './plugins/schemas.plugin.js'
import { eventsRoutes } from './routes/events.routes.js'
import { env } from './config/env.js'
import { closeDb } from './db/index.js'

const server = Fastify({ logger: true })

server.addHook('onClose', async () => {
  await closeDb()
})

async function main() {
  await server.register(swaggerPlugin)
  await server.register(schemasPlugin)
  await server.register(eventsRoutes)

  const address = await server.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Server running at ${address}`)
  console.log(`Swagger UI: ${address}/docs`)
}

main().catch((err) => {
  server.log.error(err)
  process.exit(1)
})
