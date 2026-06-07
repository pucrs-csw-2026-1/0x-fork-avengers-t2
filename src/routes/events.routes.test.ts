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

import { eventRepository } from '../repositories/event.repository.js'

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
  it('retorna métricas agregadas com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/metrics', headers: auth() })

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
  it('atualiza evento completo e retorna 200', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw',
      headers: auth(),
      payload: {
        title: 'Evento Atualizado',
        starts_at: '2026-07-01T09:00:00Z',
        ends_at: '2026-07-01T18:00:00Z',
        timezone: 'America/Sao_Paulo',
        capacity: 150,
        created_by: 'ignorado',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('id')
    expect(body.created_by).toBe(TEST_USER_ID)
  })

  it('rejeita body inválido com 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/events/evt_01hw',
      headers: auth(),
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
      headers: auth(),
      payload: { title: 'Novo Título' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('id')
    expect(body.created_by).toBe(TEST_USER_ID)
  })

  it('aceita body vazio', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/evt_01hw',
      headers: auth(),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('DELETE /events/:id', () => {
  it('faz soft delete e retorna 200 com deleted_at e deleted_by do token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/events/evt_01hw', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('deleted_at')
    expect(body.deleted_at).not.toBeNull()
    expect(body.deleted_by).toBe(TEST_USER_ID)
  })
})

describe('GET /events/:id/activitys', () => {
  it('lista seções do evento com 200', async () => {
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

describe('GET /events/:id/roles', () => {
  it('lista roles do evento com 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/roles', headers: auth() })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('event_id')
    expect(body[0]).toHaveProperty('role')
  })

  it('retorna event_id igual ao parâmetro da URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/evt_01hw/roles', headers: auth() })
    const body = res.json()
    expect(body[0].event_id).toBe('evt_01hw')
  })
})

describe('POST /events/:id/roles', () => {
  it('adiciona role ao evento e retorna 201', async () => {
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
    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt_01hw/roles/staff',
      headers: auth(),
    })

    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })
})
