import { eq, isNull, and, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { events } from '../db/schema.js'
import type { Event, CreateEvent, UpdateEvent } from '../schemas/event.schema.js'

type EventRow = typeof events.$inferSelect

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    title: row.title,
    ...(row.description != null ? { description: row.description } : {}),
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
    timezone: row.timezone,
    ...(row.registration_deadline != null
      ? { registration_deadline: row.registration_deadline.toISOString() }
      : {}),
    ...(row.location != null ? { location: row.location as Event['location'] } : {}),
    capacity: row.capacity,
    ...(row.category != null ? { category: row.category } : {}),
    status: row.status,
    ...(row.language != null ? { language: row.language } : {}),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at != null ? row.deleted_at.toISOString() : null,
    deleted_by: row.deleted_by,
    created_by: row.created_by,
  }
}

export const eventRepository = {
  async create(data: CreateEvent): Promise<Event> {
    const [row] = await db
      .insert(events)
      .values({
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description ?? null,
        starts_at: new Date(data.starts_at),
        ends_at: new Date(data.ends_at),
        timezone: data.timezone,
        registration_deadline:
          data.registration_deadline != null
            ? new Date(data.registration_deadline)
            : null,
        location: (data.location as unknown) ?? null,
        capacity: data.capacity,
        category: data.category ?? null,
        ...(data.status != null ? { status: data.status } : {}),
        language: data.language ?? null,
        created_by: data.created_by,
      })
      .returning()

    return rowToEvent(row)
  },

  async findAll(
    options: { page: number; limit: number },
  ): Promise<{ data: Event[]; total: number; page: number; limit: number }> {
    const { page, limit } = options
    const offset = (page - 1) * limit

    const [{ total }] = await db
      .select({ total: count() })
      .from(events)
      .where(isNull(events.deleted_at))

    const rows = await db
      .select()
      .from(events)
      .where(isNull(events.deleted_at))
      .limit(limit)
      .offset(offset)

    return { data: rows.map(rowToEvent), total, page, limit }
  },

  async findById(id: string): Promise<Event | null> {
    const rows = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), isNull(events.deleted_at)))

    return rows.length > 0 ? rowToEvent(rows[0]) : null
  },

  async update(id: string, data: CreateEvent): Promise<Event | null> {
    const rows = await db
      .update(events)
      .set({
        title: data.title,
        description: data.description ?? null,
        starts_at: new Date(data.starts_at),
        ends_at: new Date(data.ends_at),
        timezone: data.timezone,
        registration_deadline:
          data.registration_deadline != null
            ? new Date(data.registration_deadline)
            : null,
        location: (data.location as unknown) ?? null,
        capacity: data.capacity,
        category: data.category ?? null,
        ...(data.status != null ? { status: data.status } : {}),
        language: data.language ?? null,
        updated_at: new Date(),
      })
      .where(and(eq(events.id, id), isNull(events.deleted_at)))
      .returning()

    return rows.length > 0 ? rowToEvent(rows[0]) : null
  },

  async partialUpdate(id: string, data: UpdateEvent): Promise<Event | null> {
    const rows = await db
      .update(events)
      .set({
        updated_at: new Date(),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.starts_at !== undefined ? { starts_at: new Date(data.starts_at) } : {}),
        ...(data.ends_at !== undefined ? { ends_at: new Date(data.ends_at) } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.registration_deadline !== undefined
          ? {
              registration_deadline: data.registration_deadline
                ? new Date(data.registration_deadline)
                : null,
            }
          : {}),
        ...(data.location !== undefined ? { location: (data.location as unknown) ?? null } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
      })
      .where(and(eq(events.id, id), isNull(events.deleted_at)))
      .returning()

    return rows.length > 0 ? rowToEvent(rows[0]) : null
  },

  async softDelete(id: string, deletedBy: string): Promise<Event | null> {
    const rows = await db
      .update(events)
      .set({
        deleted_at: new Date(),
        deleted_by: deletedBy,
        updated_at: new Date(),
      })
      .where(and(eq(events.id, id), isNull(events.deleted_at)))
      .returning()

    return rows.length > 0 ? rowToEvent(rows[0]) : null
  },
}
