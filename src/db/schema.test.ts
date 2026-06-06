import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { events, activities, eventRoles } from './schema.js'

type ColMap = Record<string, { notNull: boolean; hasDefault: boolean; primary?: boolean }>

describe('events table schema', () => {
  const cols = getTableColumns(events) as ColMap
  const columnNames = Object.keys(cols)

  it('has all required columns', () => {
    const required = ['id', 'title', 'starts_at', 'ends_at', 'timezone', 'capacity', 'created_by', 'created_at', 'updated_at']
    required.forEach(col => expect(columnNames).toContain(col))
  })

  it('has all nullable columns', () => {
    const nullable = ['description', 'registration_deadline', 'location', 'category', 'language', 'deleted_at', 'deleted_by']
    nullable.forEach(col => expect(columnNames).toContain(col))
  })

  it('id is primary key', () => {
    expect(cols.id.primary).toBe(true)
  })

  it('required columns are notNull', () => {
    const requiredNotNull = ['title', 'starts_at', 'ends_at', 'timezone', 'capacity', 'created_by', 'created_at', 'updated_at']
    requiredNotNull.forEach(col => expect(cols[col].notNull, `${col} should be notNull`).toBe(true))
  })

  it('nullable columns are not notNull', () => {
    const nullable = ['description', 'registration_deadline', 'location', 'category', 'language', 'deleted_at', 'deleted_by']
    nullable.forEach(col => expect(cols[col].notNull, `${col} should be nullable`).toBe(false))
  })

  it('created_at has defaultNow', () => {
    expect(cols.created_at.hasDefault).toBe(true)
  })

  it('updated_at has defaultNow', () => {
    expect(cols.updated_at.hasDefault).toBe(true)
  })

  it('has exactly the expected number of columns', () => {
    expect(columnNames).toHaveLength(16)
  })
})

describe('activities table schema', () => {
  const cols = getTableColumns(activities) as ColMap
  const columnNames = Object.keys(cols)

  it('has all required columns', () => {
    const required = ['id_activity', 'event_id', 'title_activity', 'type', 'starts_at', 'ends_at', 'timezone', 'workload_minutes', 'created_by', 'created_at', 'updated_at']
    required.forEach(col => expect(columnNames).toContain(col))
  })

  it('has all nullable columns', () => {
    const nullable = ['description_activity', 'thumbnail_url', 'capacity_activity', 'registration_deadline_activity', 'category_activity', 'language_activity', 'deleted_at', 'deleted_by']
    nullable.forEach(col => expect(columnNames).toContain(col))
  })

  it('has registration_deadline_activity aligned with TypeBox schema', () => {
    expect(columnNames).toContain('registration_deadline_activity')
  })

  it('id_activity is primary key', () => {
    expect(cols.id_activity.primary).toBe(true)
  })

  it('required columns are notNull', () => {
    const requiredNotNull = ['event_id', 'title_activity', 'type', 'starts_at', 'ends_at', 'timezone', 'workload_minutes', 'created_by', 'created_at', 'updated_at']
    requiredNotNull.forEach(col => expect(cols[col].notNull, `${col} should be notNull`).toBe(true))
  })

  it('nullable columns are not notNull', () => {
    const nullable = ['description_activity', 'thumbnail_url', 'capacity_activity', 'registration_deadline_activity', 'category_activity', 'language_activity', 'deleted_at', 'deleted_by']
    nullable.forEach(col => expect(cols[col].notNull, `${col} should be nullable`).toBe(false))
  })

  it('created_at has defaultNow', () => {
    expect(cols.created_at.hasDefault).toBe(true)
  })

  it('updated_at has defaultNow', () => {
    expect(cols.updated_at.hasDefault).toBe(true)
  })

  it('has exactly the expected number of columns', () => {
    expect(columnNames).toHaveLength(19)
  })
})

describe('event_roles table schema', () => {
  const cols = getTableColumns(eventRoles) as ColMap
  const columnNames = Object.keys(cols)

  it('has event_id and role as composite primary key columns', () => {
    expect(columnNames).toContain('event_id')
    expect(columnNames).toContain('role')
    expect(columnNames).toHaveLength(2)
  })

  it('event_id is notNull', () => {
    expect(cols.event_id.notNull).toBe(true)
  })

  it('role is notNull', () => {
    expect(cols.role.notNull).toBe(true)
  })
})
