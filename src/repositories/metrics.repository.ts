import { count, sum, isNull, and, gt, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { events, activities } from '../db/schema.js'

export type EventStats = {
  total_events: number
  total_activitys: number
  total_capacity: number
  events_by_category: Record<string, number>
  events_by_status: { upcoming: number; ongoing: number; past: number }
  eventIds: string[]
}

export const metricsRepository = {
  async getEventStats(): Promise<EventStats> {
    const now = new Date()

    const [
      [{ total_events }],
      [{ total_activitys }],
      [{ total_capacity }],
      [{ upcoming }],
      [{ ongoing }],
      [{ past }],
      categoryRows,
      eventRows,
    ] = await Promise.all([
      db.select({ total_events: count() }).from(events).where(isNull(events.deleted_at)),
      db.select({ total_activitys: count() }).from(activities).where(isNull(activities.deleted_at)),
      db.select({ total_capacity: sum(events.capacity) }).from(events).where(isNull(events.deleted_at)),
      db.select({ upcoming: count() }).from(events).where(and(isNull(events.deleted_at), gt(events.starts_at, now))),
      db.select({ ongoing: count() }).from(events).where(and(isNull(events.deleted_at), lte(events.starts_at, now), gt(events.ends_at, now))),
      db.select({ past: count() }).from(events).where(and(isNull(events.deleted_at), lte(events.ends_at, now))),
      db.select({ category: events.category, total: count() }).from(events).where(isNull(events.deleted_at)).groupBy(events.category),
      db.select({ id: events.id }).from(events).where(isNull(events.deleted_at)),
    ])

    return {
      total_events,
      total_activitys,
      total_capacity: Number(total_capacity ?? 0),
      events_by_status: { upcoming, ongoing, past },
      events_by_category: Object.fromEntries(
        categoryRows.map((r) => [r.category ?? 'unknown', r.total]),
      ),
      eventIds: eventRows.map((r) => r.id),
    }
  },
}
