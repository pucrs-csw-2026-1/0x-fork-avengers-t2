import { pgTable, text, integer, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core'

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  starts_at: timestamp('starts_at', { withTimezone: true }).notNull(),
  ends_at: timestamp('ends_at', { withTimezone: true }).notNull(),
  timezone: text('timezone').notNull(),
  registration_deadline: timestamp('registration_deadline', { withTimezone: true }),
  location: jsonb('location'),
  capacity: integer('capacity').notNull(),
  category: text('category'),
  language: text('language'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  deleted_by: text('deleted_by'),
  created_by: text('created_by').notNull(),
})

export const activities = pgTable('activities', {
  id_activity: text('id_activity').primaryKey(),
  event_id: text('event_id').notNull().references(() => events.id),
  title_activity: text('title_activity').notNull(),
  description_activity: text('description_activity'),
  type: text('type').notNull(),
  starts_at: timestamp('starts_at', { withTimezone: true }).notNull(),
  ends_at: timestamp('ends_at', { withTimezone: true }).notNull(),
  timezone: text('timezone').notNull(),
  thumbnail_url: text('thumbnail_url'),
  capacity_activity: integer('capacity_activity'),
  workload_minutes: integer('workload_minutes').notNull(),
  category_activity: text('category_activity'),
  language_activity: text('language_activity'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  deleted_by: text('deleted_by'),
  created_by: text('created_by').notNull(),
})

export const eventRoles = pgTable('event_roles', {
  event_id: text('event_id').notNull().references(() => events.id),
  role: text('role').notNull(),
}, (table) => [
  primaryKey({ columns: [table.event_id, table.role] }),
])
