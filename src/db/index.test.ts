import { describe, it, expect, afterAll } from 'vitest'
import { db, closeDb } from './index.js'

describe('database connection', () => {
  afterAll(async () => {
    await closeDb()
  })

  it('exports db instance', () => {
    expect(db).toBeDefined()
  })

  it('exports closeDb as a function', () => {
    expect(typeof closeDb).toBe('function')
  })

  it('closeDb returns a Promise when called', () => {
    expect(closeDb.constructor.name).toBe('AsyncFunction')
  })

  it('db.query exposes events table', () => {
    expect(db.query.events).toBeDefined()
  })

  it('db.query exposes activities table', () => {
    expect(db.query.activities).toBeDefined()
  })

  it('db.query exposes eventRoles table', () => {
    expect(db.query.eventRoles).toBeDefined()
  })
})
