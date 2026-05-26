import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../test/app.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

describe('POST /events', () => {
  it('cria evento e retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        title: 'Evento Teste',
        starts_at: '2026-07-01T09:00:00Z',
        ends_at: '2026-07-01T18:00:00Z',
        timezone: 'America/Sao_Paulo',
        capacity: 100,
        created_by: 'usr_test',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('title')
    expect(body).toHaveProperty('created_at')
  })

  it('rejeita body inválido com 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: { title: 'Sem campos obrigatórios' },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /events', () => {
  it('retorna lista paginada com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('limit')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('aceita query params de paginação', async () => {
    const res = await app.inject({ method: 'GET', url: '/events?page=2&limit=10' })

    expect(res.statusCode).toBe(200)
  })

  it('rejeita page=0 com 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/events?page=0' })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /events/metrics', () => {
  it('retorna métricas agregadas com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/metrics' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('total_events')
    expect(body).toHaveProperty('total_activitys')
    expect(body).toHaveProperty('total_capacity')
    expect(body).toHaveProperty('total_enrolled')
    expect(body).toHaveProperty('total_available_spots')
    expect(body).toHaveProperty('average_occupancy_percentage')
    expect(body).toHaveProperty('events_by_category')
    expect(body).toHaveProperty('events_by_status')
    expect(body.events_by_status).toHaveProperty('upcoming')
    expect(body.events_by_status).toHaveProperty('ongoing')
    expect(body.events_by_status).toHaveProperty('past')
  })
})

describe('GET /events/:id', () => {
  it('retorna evento por ID com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('title')
  })
})

describe('PUT /events/:id', () => {
  it('atualiza evento completo e retorna 200', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw',
      payload: {
        title: 'Evento Atualizado',
        starts_at: '2026-07-01T09:00:00Z',
        ends_at: '2026-07-01T18:00:00Z',
        timezone: 'America/Sao_Paulo',
        capacity: 150,
        created_by: 'usr_test',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('id')
  })

  it('rejeita body inválido com 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /events/:id', () => {
  it('atualiza evento parcialmente e retorna 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt_01hw',
      payload: { title: 'Novo Título' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('id')
  })

  it('aceita body vazio', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt_01hw',
      payload: {},
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('DELETE /events/:id', () => {
  it('faz soft delete e retorna 200 com deleted_at preenchido', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/events/evt_01hw' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('deleted_at')
    expect(body.deleted_at).not.toBeNull()
    expect(body).toHaveProperty('deleted_by')
  })
})

describe('GET /events/:id/activitys', () => {
  it('lista seções do evento com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/activitys' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('id_activity')
    expect(body[0]).toHaveProperty('workload_minutes')
  })
})

describe('GET /events/:id/roles', () => {
  it('lista roles do evento com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/roles' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('event_id')
    expect(body[0]).toHaveProperty('role')
  })

  it('retorna event_id igual ao parâmetro da URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/roles' })

    const body = res.json()
    expect(body[0].event_id).toBe('evt_01hw')
  })
})

describe('POST /events/:id/roles', () => {
  it('adiciona role ao evento e retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt_01hw/roles',
      payload: { role: 'staff' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.event_id).toBe('evt_01hw')
    expect(body.role).toBe('staff')
  })

  it('rejeita body sem role com 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt_01hw/roles',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /events/:id/roles/:role', () => {
  it('remove role do evento e retorna 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt_01hw/roles/staff',
    })

    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })
})
