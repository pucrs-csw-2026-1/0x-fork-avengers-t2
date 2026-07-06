import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import type { CreateEventBody, UpdateEvent } from '../schemas/event.schema.js'
import type { CreateActivityBody, UpdateActivity } from '../schemas/activity.schema.js'
import type { EventRole } from '../schemas/event-role.schema.js'
import type { EventsMetrics } from '../schemas/metrics.schema.js'
import { eventRepository } from '../repositories/event.repository.js'
import { activityRepository } from '../repositories/activity.repository.js'
import { metricsRepository } from '../repositories/metrics.repository.js'
import { requireScope } from '../plugins/auth.plugin.js'
import { roleRepository } from '../repositories/role.repository.js'
import { registrationClient } from '../clients/registration.client.js'
import { snsClient } from '../clients/sns.client.js'

const ParamsIdSchema = Type.Object({ id: Type.String() })
const ParamsActivitySchema = Type.Object({ id: Type.String(), activityId: Type.String() })

export async function eventsRoutes(fastify: FastifyInstance) {
  fastify.post('/events', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Events'],
      summary: 'Cria um evento',
      body: { $ref: 'CreateEventBody#' },
      response: { 201: { $ref: 'Event#' } },
    },
    handler: async (req, reply) => {
      const body = req.body as CreateEventBody
      const event = await eventRepository.create({ ...body, created_by: req.user.id })
      void snsClient.publishEventCreated(event.id, event.id)
      return reply.status(201).send(event)
    },
  })

  fastify.get('/events', {
    schema: {
      tags: ['Events'],
      summary: 'Lista eventos com paginação',
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
      }),
      response: { 200: { $ref: 'EventListResponse#' } },
    },
    handler: async (req) => {
      const { page, limit } = req.query as { page: number; limit: number }
      return eventRepository.findAll({ page, limit })
    },
  })

  fastify.get('/events/metrics', {
    schema: {
      tags: ['Events'],
      summary: 'Métricas agregadas de todos os eventos',
      response: { 200: { $ref: 'EventsMetrics#' } },
    },
    handler: async (): Promise<EventsMetrics> => {
      const stats = await metricsRepository.getEventStats()
      const totalEnrolled = await registrationClient.getTotalEnrolled(stats.eventIds)
      const totalCapacity = stats.total_capacity
      const totalAvailableSpots = Math.max(0, totalCapacity - totalEnrolled)
      const averageOccupancy =
        totalCapacity > 0
          ? Math.min(100, Math.round((totalEnrolled / totalCapacity) * 10000) / 100)
          : 0

      return {
        total_events: stats.total_events,
        total_activitys: stats.total_activitys,
        total_capacity: totalCapacity,
        total_enrolled: totalEnrolled,
        total_available_spots: totalAvailableSpots,
        average_occupancy_percentage: averageOccupancy,
        events_by_category: stats.events_by_category,
        events_by_status: stats.events_by_status,
      }
    },
  })

  fastify.get('/events/:id', {
    schema: {
      tags: ['Events'],
      summary: 'Busca evento por ID',
      params: ParamsIdSchema,
      response: {
        200: { $ref: 'Event#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      const event = await eventRepository.findById(id)
      if (!event) {
        return reply.status(404).send({ error: 'Evento não encontrado' })
      }
      return reply.send(event)
    },
  })

  fastify.put('/events/:id', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Events'],
      summary: 'Atualiza evento completo',
      params: ParamsIdSchema,
      body: { $ref: 'CreateEventBody#' },
      response: {
        200: { $ref: 'Event#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as CreateEventBody
      const event = await eventRepository.update(id, { ...body, created_by: req.user.id })
      if (!event) {
        return reply.status(404).send({ error: 'Evento não encontrado' })
      }
      void snsClient.publishEventUpdated(event.id, event.id)
      return reply.send(event)
    },
  })

  fastify.patch('/events/:id', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Events'],
      summary: 'Atualiza evento parcialmente',
      params: ParamsIdSchema,
      body: { $ref: 'UpdateEvent#' },
      response: {
        200: { $ref: 'Event#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as UpdateEvent
      const event = await eventRepository.partialUpdate(id, body)
      if (!event) {
        return reply.status(404).send({ error: 'Evento não encontrado' })
      }
      void snsClient.publishEventUpdated(event.id, event.id)
      return reply.send(event)
    },
  })

  fastify.delete('/events/:id', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Events'],
      summary: 'Soft delete — preenche deleted_at',
      params: ParamsIdSchema,
      response: {
        200: { $ref: 'Event#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      // Sem coluna `status` no schema e sem handler confirmado para
      // EventStatusChanged no consumidor (risco de DLQ/UnknownEventTypeError):
      // nenhum evento de domínio é publicado neste soft-delete por ora.
      const event = await eventRepository.softDelete(id, req.user.id)
      if (!event) {
        return reply.status(404).send({ error: 'Evento não encontrado' })
      }
      return reply.send(event)
    },
  })

  fastify.get('/events/:id/activitys', {
    schema: {
      tags: ['Activitys'],
      summary: 'Lista seções do evento',
      params: ParamsIdSchema,
      response: { 200: { type: 'array', items: { $ref: 'Activity#' } } },
    },
    handler: async (req) => {
      const { id } = req.params as { id: string }
      return activityRepository.findByEventId(id)
    },
  })

  fastify.post('/events/:id/activitys', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Activitys'],
      summary: 'Cria atividade no evento',
      params: ParamsIdSchema,
      body: { $ref: 'CreateActivityBody#' },
      response: { 201: { $ref: 'Activity#' } },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as CreateActivityBody
      const activity = await activityRepository.create({ ...body, event_id: id, created_by: req.user.id })
      void snsClient.publishActivityCreated(id, activity.id_activity)
      return reply.status(201).send(activity)
    },
  })

  fastify.put('/events/:id/activitys/:activityId', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Activitys'],
      summary: 'Atualiza atividade completa',
      params: ParamsActivitySchema,
      body: { $ref: 'CreateActivityBody#' },
      response: {
        200: { $ref: 'Activity#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { activityId } = req.params as { id: string; activityId: string }
      const body = req.body as CreateActivityBody
      const activity = await activityRepository.update(activityId, { ...body, created_by: req.user.id })
      if (!activity) return reply.status(404).send({ error: 'Atividade não encontrada' })
      return reply.send(activity)
    },
  })

  fastify.patch('/events/:id/activitys/:activityId', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Activitys'],
      summary: 'Atualiza atividade parcialmente',
      params: ParamsActivitySchema,
      body: { $ref: 'UpdateActivity#' },
      response: {
        200: { $ref: 'Activity#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { activityId } = req.params as { id: string; activityId: string }
      const body = req.body as UpdateActivity
      const activity = await activityRepository.partialUpdate(activityId, body)
      if (!activity) return reply.status(404).send({ error: 'Atividade não encontrada' })
      return reply.send(activity)
    },
  })

  fastify.put('/events/:id/activitys/:activityId/thumbnail', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Activitys'],
      summary: 'Define ou atualiza a thumbnail da atividade',
      params: ParamsActivitySchema,
      body: Type.Object({ thumbnail_url: Type.String({ format: 'uri' }) }),
      response: {
        200: { $ref: 'Activity#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { activityId } = req.params as { id: string; activityId: string }
      const { thumbnail_url } = req.body as { thumbnail_url: string }
      const activity = await activityRepository.partialUpdate(activityId, { thumbnail_url })
      if (!activity) return reply.status(404).send({ error: 'Atividade não encontrada' })
      return reply.send(activity)
    },
  })

  fastify.delete('/events/:id/activitys/:activityId', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Activitys'],
      summary: 'Soft delete de atividade',
      params: ParamsActivitySchema,
      response: {
        200: { $ref: 'Activity#' },
        404: Type.Object({ error: Type.String() }),
      },
    },
    handler: async (req, reply) => {
      const { activityId } = req.params as { id: string; activityId: string }
      const activity = await activityRepository.softDelete(activityId, req.user.id)
      if (!activity) return reply.status(404).send({ error: 'Atividade não encontrada' })
      return reply.send(activity)
    },
  })

  fastify.get('/events/:id/roles', {
    schema: {
      tags: ['Roles'],
      summary: 'Lista roles com permissão de matrícula no evento',
      params: ParamsIdSchema,
      response: { 200: { type: 'array', items: { $ref: 'EventRole#' } } },
    },
    handler: async (req): Promise<EventRole[]> => {
      const { id } = req.params as { id: string }
      return roleRepository.findByEventId(id)
    },
  })

  fastify.post('/events/:id/roles', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Roles'],
      summary: 'Adiciona role ao evento',
      params: ParamsIdSchema,
      body: { $ref: 'CreateEventRole#' },
      response: { 201: { $ref: 'EventRole#' } },
    },
    handler: async (req, reply): Promise<void> => {
      const { id } = req.params as { id: string }
      const { role } = req.body as { role: string }
      const created = await roleRepository.create(id, role)
      reply.status(201).send(created)
    },
  })

  fastify.delete('/events/:id/roles/:role', {
    preHandler: requireScope('manager'),
    schema: {
      tags: ['Roles'],
      summary: 'Remove role do evento',
      params: Type.Object({ id: Type.String(), role: Type.String() }),
      response: { 204: Type.Null(), 404: Type.Object({ error: Type.String() }) },
    },
    handler: async (req, reply): Promise<void> => {
      const { id, role } = req.params as { id: string; role: string }
      const deleted = await roleRepository.delete(id, role)
      if (!deleted) {
        return reply.status(404).send({ error: 'Role não encontrada' })
      }
      reply.status(204).send()
    },
  })
}
