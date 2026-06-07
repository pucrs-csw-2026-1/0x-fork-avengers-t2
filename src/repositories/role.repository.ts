import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eventRoles } from '../db/schema.js'
import type { EventRole } from '../schemas/event-role.schema.js'

export const roleRepository = {
  async findByEventId(eventId: string): Promise<EventRole[]> {
    const rows = await db.select().from(eventRoles).where(eq(eventRoles.event_id, eventId))
    return rows.map((row) => ({ event_id: row.event_id, role: row.role }))
  },

  async create(eventId: string, role: string): Promise<EventRole> {
    const rows = await db
      .insert(eventRoles)
      .values({ event_id: eventId, role })
      .onConflictDoNothing()
      .returning()

    return rows.length > 0
      ? { event_id: rows[0].event_id, role: rows[0].role }
      : { event_id: eventId, role }
  },

  async delete(eventId: string, role: string): Promise<EventRole | null> {
    const rows = await db
      .delete(eventRoles)
      .where(and(eq(eventRoles.event_id, eventId), eq(eventRoles.role, role)))
      .returning()

    return rows.length > 0 ? { event_id: rows[0].event_id, role: rows[0].role } : null
  },
}
