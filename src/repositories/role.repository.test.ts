import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '../db/index.js'
import { roleRepository } from './role.repository.js'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('findByEventId', () => {
  it('retorna lista de roles do evento', async () => {
    const rows = [
      { event_id: 'evt_01', role: 'student' },
      { event_id: 'evt_01', role: 'professor' },
    ]
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }),
    } as any)

    const result = await roleRepository.findByEventId('evt_01')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ event_id: 'evt_01', role: 'student' })
    expect(result[1]).toEqual({ event_id: 'evt_01', role: 'professor' })
  })

  it('retorna lista vazia quando não há roles', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as any)

    const result = await roleRepository.findByEventId('evt_vazio')

    expect(result).toEqual([])
  })
})

describe('create', () => {
  it('insere role e retorna EventRole', async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ event_id: 'evt_01', role: 'staff' }]),
        }),
      }),
    } as any)

    const result = await roleRepository.create('evt_01', 'staff')

    expect(result).toEqual({ event_id: 'evt_01', role: 'staff' })
  })

  it('retorna EventRole mesmo em conflito (duplicata já existente)', async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any)

    const result = await roleRepository.create('evt_01', 'student')

    expect(result).toEqual({ event_id: 'evt_01', role: 'student' })
  })
})

describe('delete', () => {
  it('remove role e retorna EventRole deletado', async () => {
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ event_id: 'evt_01', role: 'staff' }]),
      }),
    } as any)

    const result = await roleRepository.delete('evt_01', 'staff')

    expect(result).toEqual({ event_id: 'evt_01', role: 'staff' })
  })

  it('retorna null quando role não existe', async () => {
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await roleRepository.delete('evt_01', 'naoexiste')

    expect(result).toBeNull()
  })
})
