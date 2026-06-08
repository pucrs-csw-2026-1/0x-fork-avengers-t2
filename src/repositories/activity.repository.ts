import { eq, isNull, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { activities } from '../db/schema.js'
import type { Activity } from '../schemas/activity.schema.js'

type ActivityRow = typeof activities.$inferSelect

type CreateActivityData = {
  event_id: string
  title_activity: string
  description_activity?: string | null
  type: string
  starts_at: string
  ends_at: string
  timezone: string
  thumbnail_url?: string | null
  capacity_activity?: number | null
  workload_minutes: number
  registration_deadline_activity?: string | null
  category_activity?: string | null
  language_activity?: string | null
  created_by: string
}

type UpdateActivityData = Omit<CreateActivityData, 'event_id'>
type PartialActivityData = Partial<UpdateActivityData>

function rowToActivity(row: ActivityRow): Activity {
  return {
    id_activity: row.id_activity,
    title_activity: row.title_activity,
    ...(row.description_activity != null ? { description_activity: row.description_activity } : {}),
    type: row.type,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
    timezone: row.timezone,
    ...(row.registration_deadline_activity != null
      ? { registration_deadline_activity: row.registration_deadline_activity.toISOString() }
      : {}),
    ...(row.thumbnail_url != null ? { thumbnail_url: row.thumbnail_url } : {}),
    ...(row.capacity_activity != null ? { capacity_activity: row.capacity_activity } : {}),
    workload_minutes: row.workload_minutes,
    ...(row.category_activity != null ? { category_activity: row.category_activity } : {}),
    ...(row.language_activity != null ? { language_activity: row.language_activity } : {}),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at != null ? row.deleted_at.toISOString() : null,
    deleted_by: row.deleted_by,
    created_by: row.created_by,
  }
}

export const activityRepository = {
  async findByEventId(eventId: string): Promise<Activity[]> {
    const rows = await db
      .select()
      .from(activities)
      .where(and(eq(activities.event_id, eventId), isNull(activities.deleted_at)))

    return rows.map(rowToActivity)
  },

  async findById(id: string): Promise<Activity | null> {
    const rows = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id_activity, id), isNull(activities.deleted_at)))

    return rows.length > 0 ? rowToActivity(rows[0]) : null
  },

  async create(data: CreateActivityData): Promise<Activity> {
    const [row] = await db
      .insert(activities)
      .values({
        id_activity: crypto.randomUUID(),
        event_id: data.event_id,
        title_activity: data.title_activity,
        description_activity: data.description_activity ?? null,
        type: data.type,
        starts_at: new Date(data.starts_at),
        ends_at: new Date(data.ends_at),
        timezone: data.timezone,
        thumbnail_url: data.thumbnail_url ?? null,
        capacity_activity: data.capacity_activity ?? null,
        workload_minutes: data.workload_minutes,
        registration_deadline_activity:
          data.registration_deadline_activity != null
            ? new Date(data.registration_deadline_activity)
            : null,
        category_activity: data.category_activity ?? null,
        language_activity: data.language_activity ?? null,
        created_by: data.created_by,
      })
      .returning()

    return rowToActivity(row)
  },

  async update(id: string, data: UpdateActivityData): Promise<Activity | null> {
    const rows = await db
      .update(activities)
      .set({
        title_activity: data.title_activity,
        description_activity: data.description_activity ?? null,
        type: data.type,
        starts_at: new Date(data.starts_at),
        ends_at: new Date(data.ends_at),
        timezone: data.timezone,
        thumbnail_url: data.thumbnail_url ?? null,
        capacity_activity: data.capacity_activity ?? null,
        workload_minutes: data.workload_minutes,
        registration_deadline_activity:
          data.registration_deadline_activity != null
            ? new Date(data.registration_deadline_activity)
            : null,
        category_activity: data.category_activity ?? null,
        language_activity: data.language_activity ?? null,
        updated_at: new Date(),
      })
      .where(and(eq(activities.id_activity, id), isNull(activities.deleted_at)))
      .returning()

    return rows.length > 0 ? rowToActivity(rows[0]) : null
  },

  async partialUpdate(id: string, data: PartialActivityData): Promise<Activity | null> {
    const rows = await db
      .update(activities)
      .set({
        updated_at: new Date(),
        ...(data.title_activity !== undefined ? { title_activity: data.title_activity } : {}),
        ...(data.description_activity !== undefined ? { description_activity: data.description_activity } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.starts_at !== undefined ? { starts_at: new Date(data.starts_at) } : {}),
        ...(data.ends_at !== undefined ? { ends_at: new Date(data.ends_at) } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.thumbnail_url !== undefined ? { thumbnail_url: data.thumbnail_url } : {}),
        ...(data.capacity_activity !== undefined ? { capacity_activity: data.capacity_activity } : {}),
        ...(data.workload_minutes !== undefined ? { workload_minutes: data.workload_minutes } : {}),
        ...(data.registration_deadline_activity !== undefined
          ? {
              registration_deadline_activity: data.registration_deadline_activity
                ? new Date(data.registration_deadline_activity)
                : null,
            }
          : {}),
        ...(data.category_activity !== undefined ? { category_activity: data.category_activity } : {}),
        ...(data.language_activity !== undefined ? { language_activity: data.language_activity } : {}),
      })
      .where(and(eq(activities.id_activity, id), isNull(activities.deleted_at)))
      .returning()

    return rows.length > 0 ? rowToActivity(rows[0]) : null
  },

  async softDelete(id: string, deletedBy: string): Promise<Activity | null> {
    const rows = await db
      .update(activities)
      .set({
        deleted_at: new Date(),
        deleted_by: deletedBy,
        updated_at: new Date(),
      })
      .where(and(eq(activities.id_activity, id), isNull(activities.deleted_at)))
      .returning()

    return rows.length > 0 ? rowToActivity(rows[0]) : null
  },
}
