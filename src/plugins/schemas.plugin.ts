import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { EventSchema, CreateEventSchema, CreateEventBodySchema, UpdateEventSchema, EventListResponseSchema } from '../schemas/event.schema.js'
import { ActivitySchema, CreateActivityBodySchema, UpdateActivitySchema } from '../schemas/activity.schema.js'
import { EventRoleSchema, CreateEventRoleSchema } from '../schemas/event-role.schema.js'
import { EventMetricsSchema, EventsMetricsSchema } from '../schemas/metrics.schema.js'

export default fp(async function schemasPlugin(fastify: FastifyInstance) {
  fastify.addSchema(EventSchema)
  fastify.addSchema(CreateEventSchema)
  fastify.addSchema(CreateEventBodySchema)
  fastify.addSchema(UpdateEventSchema)
  fastify.addSchema(EventListResponseSchema)
  fastify.addSchema(ActivitySchema)
  fastify.addSchema(CreateActivityBodySchema)
  fastify.addSchema(UpdateActivitySchema)
  fastify.addSchema(EventRoleSchema)
  fastify.addSchema(CreateEventRoleSchema)
  fastify.addSchema(EventMetricsSchema)
  fastify.addSchema(EventsMetricsSchema)
})
