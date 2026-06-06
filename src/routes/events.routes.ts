import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import type { Event } from '../schemas/event.schema.js'
import type { Activity } from '../schemas/activity.schema.js'
import type { EventRole } from '../schemas/event-role.schema.js'
import type { EventsMetrics } from '../schemas/metrics.schema.js'

const MOCK_EVENT: Event = {
  id: 'evt_01hw',
  title: 'Inteligência Artificial na Prática',
  description: 'Descrição do evento.',
  starts_at: '2026-06-15T19:00:00-03:00',
  ends_at: '2026-06-15T21:00:00-03:00',
  timezone: 'America/Sao_Paulo',
  registration_deadline: '2026-06-14T23:59:00-03:00',
  location: {
    venue: 'Auditório PUCRS',
    address: 'Av. Ipiranga, 6681',
    city: 'Porto Alegre',
    state: 'RS',
    country: 'BR',
  },
  capacity: 200,
  category: 'tecnologia',
  language: 'pt-BR',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-10T08:30:00Z',
  deleted_at: null,
  deleted_by: null,
  created_by: 'usr_123',
}

const MOCK_SECTION: Activity = {
  id_activity: 'sec_01hw',
  title_activity: 'Introdução à IA',
  description_activity: 'Seção introdutória.',
  type: 'palestra',
  starts_at: '2026-06-15T19:00:00-03:00',
  ends_at: '2026-06-15T20:00:00-03:00',
  timezone: 'America/Sao_Paulo',
  thumbnail_url: 'https://example.com/thumb.jpg',
  capacity_activity: 200,
  workload_minutes: 60,
  category_activity: 'tecnologia',
  language_activity: 'pt-BR',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-10T08:30:00Z',
  deleted_at: null,
  deleted_by: null,
  created_by: 'usr_123',
}

const ParamsIdSchema = Type.Object({ id: Type.String() })

export async function eventsRoutes(fastify: FastifyInstance) {
  fastify.post('/events', {
    schema: {
      tags: ['Events'],
      summary: 'Cria um evento',
      body: { $ref: 'CreateEvent#' },
      response: { 201: { $ref: 'Event#' } },
    },
    handler: async (req, reply) => {
      reply.status(201).send({ ...MOCK_EVENT, id: 'evt_new_' + Date.now(), created_by: req.user.id })
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
    handler: async () => ({ data: [MOCK_EVENT], total: 1, page: 1, limit: 20 }),
  })

  fastify.get('/events/metrics', {
    schema: {
      tags: ['Events'],
      summary: 'Métricas agregadas de todos os eventos',
      response: { 200: { $ref: 'EventsMetrics#' } },
    },
    handler: async (): Promise<EventsMetrics> => ({
      total_events: 1,
      total_activitys: 1,
      total_capacity: 200,
      total_enrolled: 87,
      total_available_spots: 113,
      average_occupancy_percentage: 43.5,
      events_by_category: { tecnologia: 1 },
      events_by_status: { upcoming: 1, ongoing: 0, past: 0 },
    }),
  })

  fastify.get('/events/:id', {
    schema: {
      tags: ['Events'],
      summary: 'Busca evento por ID',
      params: ParamsIdSchema,
      response: { 200: { $ref: 'Event#' } },
    },
    handler: async () => MOCK_EVENT,
  })

  fastify.put('/events/:id', {
    schema: {
      tags: ['Events'],
      summary: 'Atualiza evento completo',
      params: ParamsIdSchema,
      body: { $ref: 'CreateEvent#' },
      response: { 200: { $ref: 'Event#' } },
    },
    handler: async () => MOCK_EVENT,
  })

  fastify.patch('/events/:id', {
    schema: {
      tags: ['Events'],
      summary: 'Atualiza evento parcialmente',
      params: ParamsIdSchema,
      body: { $ref: 'UpdateEvent#' },
      response: { 200: { $ref: 'Event#' } },
    },
    handler: async () => MOCK_EVENT,
  })

  fastify.delete('/events/:id', {
    schema: {
      tags: ['Events'],
      summary: 'Soft delete — preenche deleted_at',
      params: ParamsIdSchema,
      response: { 200: { $ref: 'Event#' } },
    },
    handler: async (req) => ({
      ...MOCK_EVENT,
      deleted_at: new Date().toISOString(),
      deleted_by: req.user.id,
    }),
  })

  fastify.get('/events/:id/activitys', {
    schema: {
      tags: ['Activitys'],
      summary: 'Lista seções do evento',
      params: ParamsIdSchema,
      response: { 200: { type: 'array', items: { $ref: 'Activity#' } } },
    },
    handler: async (req) => [{ ...MOCK_SECTION, created_by: req.user.id }],
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
      return [
        { event_id: id, role: 'student' },
        { event_id: id, role: 'professor' },
      ]
    },
  })

  fastify.post('/events/:id/roles', {
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
      reply.status(201).send({ event_id: id, role })
    },
  })

  fastify.delete('/events/:id/roles/:role', {
    schema: {
      tags: ['Roles'],
      summary: 'Remove role do evento',
      params: Type.Object({ id: Type.String(), role: Type.String() }),
      response: { 204: Type.Null() },
    },
    handler: async (_req, reply): Promise<void> => {
      reply.status(204).send()
    },
  })
}
