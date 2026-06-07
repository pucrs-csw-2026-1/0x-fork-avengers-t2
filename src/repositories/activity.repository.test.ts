import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '../db/index.js'
import { activityRepository } from './activity.repository.js'

const STARTS_AT = new Date('2026-06-01T09:00:00.000Z')
const ENDS_AT = new Date('2026-06-01T18:00:00.000Z')
const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z')

const mockRow = {
  id_activity: 'act_001',
  event_id: 'evt_001',
  title_activity: 'Palestra de IA',
  description_activity: null as string | null,
  type: 'palestra',
  starts_at: STARTS_AT,
  ends_at: ENDS_AT,
  timezone: 'America/Sao_Paulo',
  thumbnail_url: null as string | null,
  capacity_activity: null as number | null,
  workload_minutes: 60,
  registration_deadline_activity: null as Date | null,
  category_activity: null as string | null,
  language_activity: null as string | null,
  created_at: FIXED_DATE,
  updated_at: FIXED_DATE,
  deleted_at: null as Date | null,
  deleted_by: null as string | null,
  created_by: 'usr_creator',
}

const expectedActivity = {
  id_activity: 'act_001',
  title_activity: 'Palestra de IA',
  type: 'palestra',
  starts_at: STARTS_AT.toISOString(),
  ends_at: ENDS_AT.toISOString(),
  timezone: 'America/Sao_Paulo',
  workload_minutes: 60,
  created_at: FIXED_DATE.toISOString(),
  updated_at: FIXED_DATE.toISOString(),
  deleted_at: null,
  deleted_by: null,
  created_by: 'usr_creator',
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('findByEventId', () => {
  it('retorna lista de atividades do evento', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockRow]) }),
    } as any)

    const result = await activityRepository.findByEventId('evt_001')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject(expectedActivity)
  })

  it('retorna lista vazia quando evento não tem atividades', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as any)

    const result = await activityRepository.findByEventId('evt_vazio')

    expect(result).toEqual([])
  })
})

describe('findById', () => {
  it('retorna atividade quando encontrada', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockRow]) }),
    } as any)

    const result = await activityRepository.findById('act_001')

    expect(result).toMatchObject(expectedActivity)
  })

  it('retorna null quando não encontrada', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as any)

    const result = await activityRepository.findById('naoexiste')

    expect(result).toBeNull()
  })
})

describe('create', () => {
  it('insere atividade e retorna entidade mapeada', async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockRow]) }),
    } as any)

    const result = await activityRepository.create({
      event_id: 'evt_001',
      title_activity: 'Palestra de IA',
      type: 'palestra',
      starts_at: STARTS_AT.toISOString(),
      ends_at: ENDS_AT.toISOString(),
      timezone: 'America/Sao_Paulo',
      workload_minutes: 60,
      created_by: 'usr_creator',
    })

    expect(result).toMatchObject(expectedActivity)
  })
})

describe('update', () => {
  it('retorna atividade atualizada quando encontrada', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockRow]) }),
      }),
    } as any)

    const result = await activityRepository.update('act_001', {
      title_activity: 'Palestra de IA',
      type: 'palestra',
      starts_at: STARTS_AT.toISOString(),
      ends_at: ENDS_AT.toISOString(),
      timezone: 'America/Sao_Paulo',
      workload_minutes: 60,
      created_by: 'usr_creator',
    })

    expect(result).toMatchObject(expectedActivity)
  })

  it('retorna null quando atividade não encontrada', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    } as any)

    const result = await activityRepository.update('naoexiste', {
      title_activity: 'X',
      type: 'palestra',
      starts_at: STARTS_AT.toISOString(),
      ends_at: ENDS_AT.toISOString(),
      timezone: 'America/Sao_Paulo',
      workload_minutes: 60,
      created_by: 'usr',
    })

    expect(result).toBeNull()
  })
})

describe('partialUpdate', () => {
  it('passa apenas campos fornecidos e retorna atividade', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockRow]) }),
      }),
    } as any)

    const result = await activityRepository.partialUpdate('act_001', { title_activity: 'Novo título' })

    expect(result).toMatchObject(expectedActivity)
  })

  it('retorna null quando atividade não encontrada', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    } as any)

    const result = await activityRepository.partialUpdate('naoexiste', { title_activity: 'X' })

    expect(result).toBeNull()
  })
})

describe('softDelete', () => {
  it('define deleted_at e deleted_by e retorna atividade', async () => {
    const deletedRow = { ...mockRow, deleted_at: FIXED_DATE, deleted_by: 'usr_deleter' }
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([deletedRow]) }),
      }),
    } as any)

    const result = await activityRepository.softDelete('act_001', 'usr_deleter')

    expect(result?.deleted_by).toBe('usr_deleter')
    expect(result?.deleted_at).not.toBeNull()
  })

  it('retorna null quando atividade não encontrada', async () => {
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    } as any)

    const result = await activityRepository.softDelete('naoexiste', 'usr')

    expect(result).toBeNull()
  })
})
