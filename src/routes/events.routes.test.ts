import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose'
import { buildAppWithAuth } from '../test/app.js'

vi.mock('../repositories/event.repository.js', () => ({
  eventRepository: {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    partialUpdate: vi.fn(),
    softDelete: vi.fn(),
  },
}))

vi.mock('../repositories/role.repository.js', () => ({
  roleRepository: {
    findByEventId: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../repositories/activity.repository.js', () => ({
  activityRepository: {
    findByEventId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    partialUpdate: vi.fn(),
    softDelete: vi.fn(),
  },
}))

vi.mock('../repositories/metrics.repository.js', () => ({
  metricsRepository: {
    getEventStats: vi.fn(),
  },
}))

vi.mock('../clients/registration.client.js', () => ({
  registrationClient: {
    getRegistrationCountByEvent: vi.fn(),
    getTotalEnrolled: vi.fn(),
  },
}))

vi.mock('../clients/sns.client.js', () => ({
  snsClient: {
    publishEventCreated: vi.fn().mockResolvedValue(undefined),
    publishEventUpdated: vi.fn().mockResolvedValue(undefined),
    publishEventStatusChanged: vi.fn().mockResolvedValue(undefined),
    publishActivityCreated: vi.fn().mockResolvedValue(undefined),
  },
}))

import { eventRepository } from '../repositories/event.repository.js'
import { roleRepository } from '../repositories/role.repository.js'
import { activityRepository } from '../repositories/activity.repository.js'
import { metricsRepository } from '../repositories/metrics.repository.js'
import { registrationClient } from '../clients/registration.client.js'
import { snsClient } from '../clients/sns.client.js'

let app: FastifyInstance
let token: string
const TEST_USER_ID = 'usr_test_uuid_001'

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-key-1', alg: 'RS256', use: 'sig' }
  const jwks = createLocalJWKSet({ keys: [publicJwk] })

  app = await buildAppWithAuth(jwks)

  token = await new SignJWT({
    scopes: ['participant', 'manager', 'admin'],
    principal_type: 'user',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setSubject(TEST_USER_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.resetAllMocks()
})

const auth = () => ({ authorization: `Bearer ${token}` })

describe('autenticação', () => {
  it('requisição sem token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/events' })
    expect(res.statusCode).toBe(401)
  })

  it('requisição com token inválido → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/events',
      headers: { authorization: 'Bearer token.invalido.aqui' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /events', () => {
  const MOCK_CREATED_EVENT = {
    id: 'b3b74c7a-f1c5-4b2e-9e3f-000000000001',
    title: 'Evento Teste',
    starts_at: '2026-07-01T09:00:00.000Z',
    ends_at: '2026-07-01T18:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    capacity: 100,
    created_at: '2026-06-06T12:00:00.000Z',
    updated_at: '2026-06-06T12:00:00.000Z',
    deleted_at: null,
    deleted_by: null,
    created_by: TEST_USER_ID,
  }

  const validPayload = {
    title: 'Evento Teste',
    starts_at: '2026-07-01T09:00:00Z',
    ends_at: '2026-07-01T18:00:00Z',
    timezone: 'America/Sao_Paulo',
    capacity: 100,
  }

  it('cria evento e retorna 201 com id UUID', async () => {
    vi.mocked(eventRepository.create).mockResolvedValue(MOCK_CREATED_EVENT)

    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: auth(),
      payload: validPayload,
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toHaveProperty('id', MOCK_CREATED_EVENT.id)
    expect(body).toHaveProperty('title', 'Evento Teste')
    expect(body).toHaveProperty('created_at')
    expect(vi.mocked(eventRepository.create)).toHaveBeenCalledOnce()
    expect(vi.mocked(snsClient.publishEventCreated)).toHaveBeenCalledWith(
      MOCK_CREATED_EVENT.id,
      MOCK_CREATED_EVENT.id,
      expect.objectContaining({ event_id: MOCK_CREATED_EVENT.id, title: 'Evento Teste' }),
    )
  })

  it('falha ao publicar no SNS não impede resposta 201', async () => {
    vi.mocked(eventRepository.create).mockResolvedValue(MOCK_CREATED_EVENT)
    vi.mocked(snsClient.publishEventCreated).mockRejectedValueOnce(new Error('sns indisponível'))

    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: auth(),
      payload: validPayload,
    })

    expect(res.statusCode).toBe(201)
  })

  it('created_by vem do token JWT, não do body', async () => {
    vi.mocked(eventRepository.create).mockResolvedValue(MOCK_CREATED_EVENT)

    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: auth(),
      payload: validPayload,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().created_by).toBe(TEST_USER_ID)

    const callArg = vi.mocked(eventRepository.create).mock.calls[0][0]
    expect(callArg.created_by).toBe(TEST_USER_ID)
  })

  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/events', payload: validPayload })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita body inválido com 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: auth(),
      payload: { title: 'Sem campos obrigatórios' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /events', () => {
  const MOCK_EVENT_ITEM = {
    id: 'evt_001',
    title: 'Evento Listado',
    starts_at: '2026-07-01T09:00:00.000Z',
    ends_at: '2026-07-01T18:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    capacity: 100,
    created_at: '2026-06-06T12:00:00.000Z',
    updated_at: '2026-06-06T12:00:00.000Z',
    deleted_at: null,
    deleted_by: null,
    created_by: TEST_USER_ID,
  }

  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/events' })
    expect(res.statusCode).toBe(401)
  })

  it('retorna { data, total, page, limit } com 200', async () => {
    vi.mocked(eventRepository.findAll).mockResolvedValue({
      data: [MOCK_EVENT_ITEM],
      total: 1,
      page: 1,
      limit: 20,
    })

    const res = await app.inject({ method: 'GET', url: '/events', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total', 1)
    expect(body).toHaveProperty('page', 1)
    expect(body).toHaveProperty('limit', 20)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].id).toBe('evt_001')
  })

  it('repassa page e limit corretos ao repositório', async () => {
    vi.mocked(eventRepository.findAll).mockResolvedValue({
      data: [],
      total: 0,
      page: 2,
      limit: 5,
    })

    await app.inject({ method: 'GET', url: '/events?page=2&limit=5', headers: auth() })

    expect(vi.mocked(eventRepository.findAll)).toHaveBeenCalledWith({ page: 2, limit: 5 })
  })

  it('aplica defaults page=1 e limit=20 quando não informados', async () => {
    vi.mocked(eventRepository.findAll).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    await app.inject({ method: 'GET', url: '/events', headers: auth() })

    expect(vi.mocked(eventRepository.findAll)).toHaveBeenCalledWith({ page: 1, limit: 20 })
  })

  it('banco vazio → data: [], total: 0', async () => {
    vi.mocked(eventRepository.findAll).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const res = await app.inject({ method: 'GET', url: '/events', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  it('rejeita page=0 com 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/events?page=0', headers: auth() })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /events/metrics', () => {
  const MOCK_STATS = {
    total_events: 3,
    total_activitys: 7,
    total_capacity: 500,
    events_by_category: { tecnologia: 2, educacao: 1 },
    events_by_status: { upcoming: 2, ongoing: 1, past: 0 },
    eventIds: ['evt_a', 'evt_b', 'evt_c'],
  }

  it('retorna métricas agregadas com 200 e calcula campos derivados', async () => {
    vi.mocked(metricsRepository.getEventStats).mockResolvedValue(MOCK_STATS)
    vi.mocked(registrationClient.getTotalEnrolled).mockResolvedValue(100)

    const res = await app.inject({ method: 'GET', url: '/events/metrics', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total_events).toBe(3)
    expect(body.total_activitys).toBe(7)
    expect(body.total_capacity).toBe(500)
    expect(body.total_enrolled).toBe(100)
    expect(body.total_available_spots).toBe(400)
    expect(body.average_occupancy_percentage).toBe(20)
    expect(body.events_by_category).toEqual({ tecnologia: 2, educacao: 1 })
    expect(body.events_by_status).toEqual({ upcoming: 2, ongoing: 1, past: 0 })
  })

  it('total_enrolled = 0 quando Registration Service indisponível', async () => {
    vi.mocked(metricsRepository.getEventStats).mockResolvedValue(MOCK_STATS)
    vi.mocked(registrationClient.getTotalEnrolled).mockResolvedValue(0)

    const res = await app.inject({ method: 'GET', url: '/events/metrics', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total_enrolled).toBe(0)
    expect(body.total_available_spots).toBe(500)
    expect(body.average_occupancy_percentage).toBe(0)
  })
})

describe('GET /events/:id', () => {
  const MOCK_EVENT = {
    id: 'evt-abc-123',
    title: 'Evento Por ID',
    starts_at: '2026-07-01T09:00:00.000Z',
    ends_at: '2026-07-01T18:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    capacity: 100,
    created_at: '2026-06-06T12:00:00.000Z',
    updated_at: '2026-06-06T12:00:00.000Z',
    deleted_at: null,
    deleted_by: null,
    created_by: TEST_USER_ID,
  }

  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt-abc-123' })
    expect(res.statusCode).toBe(401)
  })

  it('token inválido → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/events/evt-abc-123',
      headers: { authorization: 'Bearer token.invalido.aqui' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('token expirado → 401', async () => {
    const expiredToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c3IiLCJleHAiOjF9.invalido'
    const res = await app.inject({
      method: 'GET',
      url: '/events/evt-abc-123',
      headers: { authorization: `Bearer ${expiredToken}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('evento encontrado → 200 com todos os campos do schema', async () => {
    vi.mocked(eventRepository.findById).mockResolvedValue(MOCK_EVENT)

    const res = await app.inject({ method: 'GET', url: '/events/evt-abc-123', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe('evt-abc-123')
    expect(body.title).toBe('Evento Por ID')
    expect(body.starts_at).toBe(MOCK_EVENT.starts_at)
    expect(body.ends_at).toBe(MOCK_EVENT.ends_at)
    expect(body.timezone).toBe('America/Sao_Paulo')
    expect(body.capacity).toBe(100)
    expect(body.created_by).toBe(TEST_USER_ID)
    expect(body.created_at).toBe(MOCK_EVENT.created_at)
    expect(body.updated_at).toBe(MOCK_EVENT.updated_at)
    expect(body.deleted_at).toBeNull()
    expect(body.deleted_by).toBeNull()
  })

  it('findById chamado exatamente uma vez com o id correto', async () => {
    vi.mocked(eventRepository.findById).mockResolvedValue(MOCK_EVENT)

    await app.inject({ method: 'GET', url: '/events/evt-abc-123', headers: auth() })

    expect(vi.mocked(eventRepository.findById)).toHaveBeenCalledOnce()
    expect(vi.mocked(eventRepository.findById)).toHaveBeenCalledWith('evt-abc-123')
  })

  it('id inexistente → 404', async () => {
    vi.mocked(eventRepository.findById).mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: '/events/id-que-nao-existe', headers: auth() })

    expect(res.statusCode).toBe(404)
  })

  it('findById retornando null → 404', async () => {
    vi.mocked(eventRepository.findById).mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: '/events/qualquer-id', headers: auth() })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty('error')
  })

  it('evento soft-deletado → 404 (repositório retorna null para deleted_at preenchido)', async () => {
    vi.mocked(eventRepository.findById).mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: '/events/evt-deletado', headers: auth() })

    expect(res.statusCode).toBe(404)
  })

  it('id com caractere especial → 404', async () => {
    vi.mocked(eventRepository.findById).mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: '/events/id%20invalido', headers: auth() })

    expect(res.statusCode).toBe(404)
  })
})

describe('PUT /events/:id', () => {
  const MOCK_UPDATED_EVENT = {
    id: 'evt-update-test',
    title: 'Evento Atualizado',
    starts_at: '2026-07-01T09:00:00.000Z',
    ends_at: '2026-07-01T18:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    capacity: 150,
    created_at: '2026-06-06T12:00:00.000Z',
    updated_at: '2026-06-07T10:00:00.000Z',
    deleted_at: null,
    deleted_by: null,
    created_by: TEST_USER_ID,
  }

  const validPutPayload = {
    title: 'Evento Atualizado',
    starts_at: '2026-07-01T09:00:00Z',
    ends_at: '2026-07-01T18:00:00Z',
    timezone: 'America/Sao_Paulo',
    capacity: 150,
  }

  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'PUT', url: '/events/evt-update-test', payload: validPutPayload })
    expect(res.statusCode).toBe(401)
  })

  it('atualiza evento completo e retorna 200', async () => {
    vi.mocked(eventRepository.update).mockResolvedValue(MOCK_UPDATED_EVENT)

    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt-update-test',
      headers: auth(),
      payload: validPutPayload,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(MOCK_UPDATED_EVENT.id)
    expect(body.title).toBe('Evento Atualizado')
    expect(body.created_by).toBe(TEST_USER_ID)
    expect(vi.mocked(snsClient.publishEventUpdated)).toHaveBeenCalledWith(
      MOCK_UPDATED_EVENT.id,
      MOCK_UPDATED_EVENT.id,
      expect.objectContaining({ event_id: MOCK_UPDATED_EVENT.id }),
    )
  })

  it('EventRepository.update chamado com id correto e created_by do token', async () => {
    vi.mocked(eventRepository.update).mockResolvedValue(MOCK_UPDATED_EVENT)

    await app.inject({
      method: 'PUT',
      url: '/events/evt-update-test',
      headers: auth(),
      payload: validPutPayload,
    })

    expect(vi.mocked(eventRepository.update)).toHaveBeenCalledOnce()
    expect(vi.mocked(eventRepository.update)).toHaveBeenCalledWith(
      'evt-update-test',
      expect.objectContaining({ title: 'Evento Atualizado', created_by: TEST_USER_ID }),
    )
  })

  it('evento não encontrado → 404', async () => {
    vi.mocked(eventRepository.update).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT',
      url: '/events/id-inexistente',
      headers: auth(),
      payload: validPutPayload,
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Evento não encontrado')
  })

  it('body inválido (campos obrigatórios faltando) → 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt-update-test',
      headers: auth(),
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /events/:id', () => {
  const MOCK_PATCHED_EVENT = {
    id: 'evt-patch-test',
    title: 'Novo Título',
    starts_at: '2026-07-01T09:00:00.000Z',
    ends_at: '2026-07-01T18:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    capacity: 200,
    created_at: '2026-06-06T12:00:00.000Z',
    updated_at: '2026-06-07T11:00:00.000Z',
    deleted_at: null,
    deleted_by: null,
    created_by: TEST_USER_ID,
  }

  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/events/evt-patch-test', payload: { title: 'Novo' } })
    expect(res.statusCode).toBe(401)
  })

  it('atualiza evento parcialmente e retorna 200', async () => {
    vi.mocked(eventRepository.partialUpdate).mockResolvedValue(MOCK_PATCHED_EVENT)

    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt-patch-test',
      headers: auth(),
      payload: { title: 'Novo Título' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(MOCK_PATCHED_EVENT.id)
    expect(body.title).toBe('Novo Título')
    expect(body.created_by).toBe(TEST_USER_ID)
    expect(vi.mocked(snsClient.publishEventUpdated)).toHaveBeenCalledWith(
      MOCK_PATCHED_EVENT.id,
      MOCK_PATCHED_EVENT.id,
      expect.objectContaining({ event_id: MOCK_PATCHED_EVENT.id }),
    )
  })

  it('EventRepository.partialUpdate chamado com id e body corretos', async () => {
    vi.mocked(eventRepository.partialUpdate).mockResolvedValue(MOCK_PATCHED_EVENT)

    await app.inject({
      method: 'PATCH',
      url: '/events/evt-patch-test',
      headers: auth(),
      payload: { title: 'Novo Título' },
    })

    expect(vi.mocked(eventRepository.partialUpdate)).toHaveBeenCalledOnce()
    expect(vi.mocked(eventRepository.partialUpdate)).toHaveBeenCalledWith(
      'evt-patch-test',
      expect.objectContaining({ title: 'Novo Título' }),
    )
  })

  it('evento não encontrado → 404', async () => {
    vi.mocked(eventRepository.partialUpdate).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: '/events/id-inexistente',
      headers: auth(),
      payload: { title: 'Qualquer' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Evento não encontrado')
  })

  it('body vazio é válido → 200', async () => {
    vi.mocked(eventRepository.partialUpdate).mockResolvedValue(MOCK_PATCHED_EVENT)

    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt-patch-test',
      headers: auth(),
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    expect(vi.mocked(eventRepository.partialUpdate)).toHaveBeenCalledOnce()
  })

  it('PATCH com status → publica EventStatusChanged, não EventUpdated', async () => {
    const patched = { ...MOCK_PATCHED_EVENT, status: 'cancelado' }
    vi.mocked(eventRepository.partialUpdate).mockResolvedValue(patched)

    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt-patch-test',
      headers: auth(),
      payload: { status: 'cancelado' },
    })

    expect(res.statusCode).toBe(200)
    expect(vi.mocked(snsClient.publishEventStatusChanged)).toHaveBeenCalledWith(
      'evt-patch-test',
      'evt-patch-test',
      expect.objectContaining({ event_id: 'evt-patch-test', status: 'cancelado' }),
    )
    expect(vi.mocked(snsClient.publishEventUpdated)).not.toHaveBeenCalled()
  })
})

describe('DELETE /events/:id', () => {
  const MOCK_DELETED_EVENT = {
    id: 'evt_01hw',
    title: 'Evento',
    starts_at: '2026-07-01T09:00:00.000Z',
    ends_at: '2026-07-01T18:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    capacity: 100,
    created_at: '2026-06-06T12:00:00.000Z',
    updated_at: '2026-06-07T00:00:00.000Z',
    deleted_at: '2026-06-07T00:00:00.000Z',
    deleted_by: TEST_USER_ID,
    created_by: TEST_USER_ID,
  }

  it('faz soft delete e retorna 200 com deleted_at e deleted_by do token', async () => {
    vi.mocked(eventRepository.softDelete).mockResolvedValue(MOCK_DELETED_EVENT)

    const res = await app.inject({ method: 'DELETE', url: '/events/evt_01hw', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.deleted_at).not.toBeNull()
    expect(body.deleted_by).toBe(TEST_USER_ID)
    expect(vi.mocked(eventRepository.softDelete)).toHaveBeenCalledWith('evt_01hw', TEST_USER_ID)
    expect(vi.mocked(snsClient.publishEventCreated)).not.toHaveBeenCalled()
    expect(vi.mocked(snsClient.publishEventUpdated)).not.toHaveBeenCalled()
  })

  it('evento não encontrado ou já deletado → 404', async () => {
    vi.mocked(eventRepository.softDelete).mockResolvedValue(null)

    const res = await app.inject({ method: 'DELETE', url: '/events/naoexiste', headers: auth() })

    expect(res.statusCode).toBe(404)
  })
})

const MOCK_ACTIVITY = {
  id_activity: 'act_001',
  title_activity: 'Palestra de IA',
  type: 'palestra',
  starts_at: '2026-07-01T09:00:00.000Z',
  ends_at: '2026-07-01T10:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  workload_minutes: 60,
  created_at: '2026-06-06T12:00:00.000Z',
  updated_at: '2026-06-06T12:00:00.000Z',
  deleted_at: null,
  deleted_by: null,
  created_by: TEST_USER_ID,
}

const validActivityPayload = {
  title_activity: 'Palestra de IA',
  type: 'palestra',
  starts_at: '2026-07-01T09:00:00Z',
  ends_at: '2026-07-01T10:00:00Z',
  timezone: 'America/Sao_Paulo',
  workload_minutes: 60,
}

describe('GET /events/:id/activitys', () => {
  it('lista seções do evento com 200', async () => {
    vi.mocked(activityRepository.findByEventId).mockResolvedValue([MOCK_ACTIVITY])

    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/activitys', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('id_activity')
    expect(body[0]).toHaveProperty('workload_minutes')
    expect(body[0].created_by).toBe(TEST_USER_ID)
  })
})

describe('POST /events/:id/activitys', () => {
  it('cria atividade e retorna 201', async () => {
    vi.mocked(activityRepository.create).mockResolvedValue(MOCK_ACTIVITY)

    const res = await app.inject({
      method: 'POST',
      url: '/events/evt_01hw/activitys',
      headers: auth(),
      payload: validActivityPayload,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id_activity).toBe('act_001')
    expect(vi.mocked(activityRepository.create)).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 'evt_01hw', created_by: TEST_USER_ID }),
    )
    expect(vi.mocked(snsClient.publishActivityCreated)).toHaveBeenCalledWith(
      'evt_01hw',
      'act_001',
      expect.objectContaining({ event_id: 'evt_01hw', activity_id: 'act_001' }),
    )
  })

  it('rejeita body sem campos obrigatórios → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt_01hw/activitys',
      headers: auth(),
      payload: { title_activity: 'Incompleto' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PUT /events/:id/activitys/:activityId', () => {
  it('atualiza atividade completa e retorna 200', async () => {
    vi.mocked(activityRepository.update).mockResolvedValue(MOCK_ACTIVITY)

    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw/activitys/act_001',
      headers: auth(),
      payload: validActivityPayload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().id_activity).toBe('act_001')
  })

  it('atividade não encontrada → 404', async () => {
    vi.mocked(activityRepository.update).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw/activitys/naoexiste',
      headers: auth(),
      payload: validActivityPayload,
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /events/:id/activitys/:activityId', () => {
  it('atualiza atividade parcialmente e retorna 200', async () => {
    vi.mocked(activityRepository.partialUpdate).mockResolvedValue(MOCK_ACTIVITY)

    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt_01hw/activitys/act_001',
      headers: auth(),
      payload: { title_activity: 'Novo título' },
    })

    expect(res.statusCode).toBe(200)
  })

  it('atividade não encontrada → 404', async () => {
    vi.mocked(activityRepository.partialUpdate).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt_01hw/activitys/naoexiste',
      headers: auth(),
      payload: { title_activity: 'X' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PUT /events/:id/activitys/:activityId/thumbnail', () => {
  it('atualiza thumbnail_url e retorna 200', async () => {
    const withThumb = { ...MOCK_ACTIVITY, thumbnail_url: 'https://cdn.example.com/img.jpg' }
    vi.mocked(activityRepository.partialUpdate).mockResolvedValue(withThumb)

    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw/activitys/act_001/thumbnail',
      headers: auth(),
      payload: { thumbnail_url: 'https://cdn.example.com/img.jpg' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().thumbnail_url).toBe('https://cdn.example.com/img.jpg')
    expect(vi.mocked(activityRepository.partialUpdate)).toHaveBeenCalledWith(
      'act_001',
      { thumbnail_url: 'https://cdn.example.com/img.jpg' },
    )
  })

  it('atividade não encontrada → 404', async () => {
    vi.mocked(activityRepository.partialUpdate).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw/activitys/naoexiste/thumbnail',
      headers: auth(),
      payload: { thumbnail_url: 'https://cdn.example.com/img.jpg' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('URL inválida → 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw/activitys/act_001/thumbnail',
      headers: auth(),
      payload: { thumbnail_url: 'not-a-url' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /events/:id/activitys/:activityId', () => {
  it('soft delete de atividade e retorna 200', async () => {
    const deleted = { ...MOCK_ACTIVITY, deleted_at: '2026-06-07T00:00:00.000Z', deleted_by: TEST_USER_ID }
    vi.mocked(activityRepository.softDelete).mockResolvedValue(deleted)

    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt_01hw/activitys/act_001',
      headers: auth(),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().deleted_by).toBe(TEST_USER_ID)
    expect(vi.mocked(activityRepository.softDelete)).toHaveBeenCalledWith('act_001', TEST_USER_ID)
  })

  it('atividade não encontrada → 404', async () => {
    vi.mocked(activityRepository.softDelete).mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt_01hw/activitys/naoexiste',
      headers: auth(),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /events/:id/roles', () => {
  it('lista roles do evento com 200', async () => {
    vi.mocked(roleRepository.findByEventId).mockResolvedValue([
      { event_id: 'evt_01hw', role: 'student' },
      { event_id: 'evt_01hw', role: 'professor' },
    ])

    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/roles', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('event_id')
    expect(body[0]).toHaveProperty('role')
  })

  it('retorna event_id igual ao parâmetro da URL', async () => {
    vi.mocked(roleRepository.findByEventId).mockResolvedValue([
      { event_id: 'evt_01hw', role: 'student' },
    ])

    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/roles', headers: auth() })
    const body = res.json()
    expect(body[0].event_id).toBe('evt_01hw')
  })
})

describe('POST /events/:id/roles', () => {
  it('adiciona role ao evento e retorna 201', async () => {
    vi.mocked(roleRepository.create).mockResolvedValue({ event_id: 'evt_01hw', role: 'staff' })

    const res = await app.inject({
      method: 'POST',
      url: '/events/evt_01hw/roles',
      headers: auth(),
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
      headers: auth(),
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /events/:id/roles/:role', () => {
  it('remove role do evento e retorna 204', async () => {
    vi.mocked(roleRepository.delete).mockResolvedValue({ event_id: 'evt_01hw', role: 'staff' })

    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt_01hw/roles/staff',
      headers: auth(),
    })

    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })

  it('role inexistente → 404', async () => {
    vi.mocked(roleRepository.delete).mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt_01hw/roles/naoexiste',
      headers: auth(),
    })

    expect(res.statusCode).toBe(404)
  })
})
