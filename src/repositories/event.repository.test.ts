import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '../db/index.js'
import { eventRepository } from './event.repository.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z')
const STARTS_AT = new Date('2026-06-01T09:00:00.000Z')
const ENDS_AT = new Date('2026-06-01T18:00:00.000Z')

const mockRow = {
  id: 'evt_001',
  title: 'Evento Teste',
  description: null as string | null,
  starts_at: STARTS_AT,
  ends_at: ENDS_AT,
  timezone: 'America/Sao_Paulo',
  registration_deadline: null as Date | null,
  location: null as unknown,
  capacity: 100,
  category: null as string | null,
  language: null as string | null,
  created_at: FIXED_DATE,
  updated_at: FIXED_DATE,
  deleted_at: null as Date | null,
  deleted_by: null as string | null,
  created_by: 'usr_creator',
}

const expectedEvent = {
  id: 'evt_001',
  title: 'Evento Teste',
  starts_at: STARTS_AT.toISOString(),
  ends_at: ENDS_AT.toISOString(),
  timezone: 'America/Sao_Paulo',
  capacity: 100,
  created_at: FIXED_DATE.toISOString(),
  updated_at: FIXED_DATE.toISOString(),
  deleted_at: null,
  deleted_by: null,
  created_by: 'usr_creator',
}

const createInput = {
  title: 'Evento Teste',
  starts_at: STARTS_AT.toISOString(),
  ends_at: ENDS_AT.toISOString(),
  timezone: 'America/Sao_Paulo',
  capacity: 100,
  created_by: 'usr_creator',
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockInsertChain(row: typeof mockRow) {
  const returning = vi.fn().mockResolvedValue([row])
  const values = vi.fn().mockReturnValue({ returning })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.insert).mockReturnValue({ values } as any)
}

function mockSelectWhereChain(result: unknown[]) {
  const where = vi.fn().mockResolvedValue(result)
  const from = vi.fn().mockReturnValue({ where })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.select).mockReturnValue({ from } as any)
}

function mockUpdateChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ returning })
  const set = vi.fn().mockReturnValue({ where })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.update).mockReturnValue({ set } as any)
  return { set }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
})

describe('create', () => {
  it('insere evento e retorna entidade mapeada', async () => {
    mockInsertChain(mockRow)

    const result = await eventRepository.create(createInput)

    expect(result).toMatchObject(expectedEvent)
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce()
  })

  it('inclui campos opcionais quando fornecidos', async () => {
    const rowWithOptionals = {
      ...mockRow,
      description: 'Descrição do evento',
      category: 'tecnologia',
      language: 'pt-BR',
      location: { venue: 'Auditório', city: 'POA', country: 'BR' },
      registration_deadline: new Date('2026-05-31T23:59:00.000Z'),
    }
    mockInsertChain(rowWithOptionals)

    const result = await eventRepository.create({
      ...createInput,
      description: 'Descrição do evento',
      category: 'tecnologia',
      language: 'pt-BR',
      location: { venue: 'Auditório', city: 'POA', country: 'BR' },
      registration_deadline: '2026-05-31T23:59:00.000Z',
    })

    expect(result.description).toBe('Descrição do evento')
    expect(result.category).toBe('tecnologia')
    expect(result.language).toBe('pt-BR')
    expect(result.location).toEqual({ venue: 'Auditório', city: 'POA', country: 'BR' })
    expect(result.registration_deadline).toBe(new Date('2026-05-31T23:59:00.000Z').toISOString())
  })
})

describe('findAll', () => {
  it('retorna lista paginada com total', async () => {
    const countWhere = vi.fn().mockResolvedValue([{ total: 2 }])
    const countFrom = vi.fn().mockReturnValue({ where: countWhere })

    const offset = vi.fn().mockResolvedValue([mockRow])
    const limit = vi.fn().mockReturnValue({ offset })
    const dataWhere = vi.fn().mockReturnValue({ limit })
    const dataFrom = vi.fn().mockReturnValue({ where: dataWhere })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.select).mockReturnValueOnce({ from: countFrom } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.select).mockReturnValueOnce({ from: dataFrom } as any)

    const result = await eventRepository.findAll({ page: 1, limit: 20 })

    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject(expectedEvent)
  })

  it('calcula offset correto para página 2', async () => {
    const countWhere = vi.fn().mockResolvedValue([{ total: 10 }])
    const countFrom = vi.fn().mockReturnValue({ where: countWhere })

    const mockOffset = vi.fn().mockResolvedValue([])
    const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset })
    const dataWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const dataFrom = vi.fn().mockReturnValue({ where: dataWhere })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.select).mockReturnValueOnce({ from: countFrom } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.select).mockReturnValueOnce({ from: dataFrom } as any)

    await eventRepository.findAll({ page: 2, limit: 5 })

    expect(mockLimit).toHaveBeenCalledWith(5)
    expect(mockOffset).toHaveBeenCalledWith(5)
  })
})

describe('findById', () => {
  it('retorna evento quando encontrado', async () => {
    mockSelectWhereChain([mockRow])

    const result = await eventRepository.findById('evt_001')

    expect(result).toMatchObject(expectedEvent)
  })

  it('retorna null quando não encontrado', async () => {
    mockSelectWhereChain([])

    const result = await eventRepository.findById('evt_inexistente')

    expect(result).toBeNull()
  })
})

describe('update', () => {
  it('retorna evento atualizado quando encontrado', async () => {
    mockUpdateChain([mockRow])

    const result = await eventRepository.update('evt_001', createInput)

    expect(result).toMatchObject(expectedEvent)
    expect(vi.mocked(db.update)).toHaveBeenCalledOnce()
  })

  it('retorna null quando evento não encontrado', async () => {
    mockUpdateChain([])

    const result = await eventRepository.update('evt_inexistente', createInput)

    expect(result).toBeNull()
  })
})

describe('partialUpdate', () => {
  it('passa apenas campos fornecidos ao banco', async () => {
    const { set } = mockUpdateChain([mockRow])

    await eventRepository.partialUpdate('evt_001', { title: 'Novo Título' })

    const setArgs = set.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs).toHaveProperty('title', 'Novo Título')
    expect(setArgs).toHaveProperty('updated_at')
    expect(setArgs).not.toHaveProperty('description')
    expect(setArgs).not.toHaveProperty('capacity')
    expect(setArgs).not.toHaveProperty('timezone')
  })

  it('retorna null quando evento não encontrado', async () => {
    mockUpdateChain([])

    const result = await eventRepository.partialUpdate('evt_inexistente', { title: 'X' })

    expect(result).toBeNull()
  })
})

describe('softDelete', () => {
  it('define deleted_at e deleted_by e retorna evento', async () => {
    const deletedRow = {
      ...mockRow,
      deleted_at: new Date('2026-06-06T12:00:00.000Z'),
      deleted_by: 'usr_admin',
      updated_at: new Date('2026-06-06T12:00:00.000Z'),
    }
    const { set } = mockUpdateChain([deletedRow])

    const result = await eventRepository.softDelete('evt_001', 'usr_admin')

    const setArgs = set.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs).toHaveProperty('deleted_at')
    expect(setArgs).toHaveProperty('deleted_by', 'usr_admin')
    expect(result).not.toBeNull()
    expect(result?.deleted_at).not.toBeNull()
    expect(result?.deleted_by).toBe('usr_admin')
  })

  it('retorna null quando evento não encontrado', async () => {
    mockUpdateChain([])

    const result = await eventRepository.softDelete('evt_inexistente', 'usr_admin')

    expect(result).toBeNull()
  })
})
