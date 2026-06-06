import { describe, it, expect } from 'vitest'
import { env } from './env.js'

describe('env config', () => {
  it('exports PORT as number', () => {
    expect(typeof env.PORT).toBe('number')
  })

  it('PORT defaults to 3000 when not set', () => {
    expect(env.PORT).toBe(3000)
  })

  it('exports HOST as string', () => {
    expect(typeof env.HOST).toBe('string')
  })

  it('HOST defaults to 0.0.0.0', () => {
    expect(env.HOST).toBe('0.0.0.0')
  })

  it('NODE_ENV is test in test environment', () => {
    expect(env.NODE_ENV).toBe('test')
  })

  it('DATABASE_URL is a valid postgresql connection string', () => {
    expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//)
  })

  it('AUTH_SERVICE_URL is a valid URL', () => {
    expect(env.AUTH_SERVICE_URL).toMatch(/^https?:\/\//)
  })

  it('optional POSTGRES_USER is defined when set', () => {
    expect(env.POSTGRES_USER).toBeDefined()
  })

  it('optional POSTGRES_PASSWORD is defined when set', () => {
    expect(env.POSTGRES_PASSWORD).toBeDefined()
  })

  it('optional POSTGRES_DB is defined when set', () => {
    expect(env.POSTGRES_DB).toBeDefined()
  })

  it('env object has only the expected keys', () => {
    const keys = Object.keys(env)
    const expected = ['PORT', 'HOST', 'NODE_ENV', 'DATABASE_URL', 'AUTH_SERVICE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']
    expected.forEach(key => expect(keys).toContain(key))
  })
})
