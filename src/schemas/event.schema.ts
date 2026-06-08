import { Type, Static } from '@sinclair/typebox'

const LocationSchema = Type.Object({
  venue: Type.Optional(Type.String({ description: 'Nome do local' })),
  address: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  state: Type.Optional(Type.String({ maxLength: 2 })),
  country: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
})

export const EventSchema = Type.Object(
  {
    id: Type.String({ examples: ['evt_01hw'] }),
    title: Type.String(),
    description: Type.Optional(Type.String()),
    starts_at: Type.String({ format: 'date-time' }),
    ends_at: Type.String({ format: 'date-time' }),
    timezone: Type.String({ examples: ['America/Sao_Paulo'] }),
    registration_deadline: Type.Optional(Type.String({ format: 'date-time' })),
    location: Type.Optional(LocationSchema),
    capacity: Type.Integer({ minimum: 1 }),
    category: Type.Optional(Type.String()),
    language: Type.Optional(Type.String({ examples: ['pt-BR'] })),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
    deleted_at: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    deleted_by: Type.Union([Type.String(), Type.Null()]),
    created_by: Type.String(),
  },
  { $id: 'Event' },
)

export const CreateEventSchema = Type.Object(
  {
    title: Type.String(),
    description: Type.Optional(Type.String()),
    starts_at: Type.String({ format: 'date-time' }),
    ends_at: Type.String({ format: 'date-time' }),
    timezone: Type.String(),
    registration_deadline: Type.Optional(Type.String({ format: 'date-time' })),
    location: Type.Optional(LocationSchema),
    capacity: Type.Integer({ minimum: 1 }),
    category: Type.Optional(Type.String()),
    language: Type.Optional(Type.String()),
    created_by: Type.String(),
  },
  { $id: 'CreateEvent' },
)

export const UpdateEventSchema = Type.Partial(CreateEventSchema, { $id: 'UpdateEvent' })

// Body schema for POST /events — created_by comes from the JWT, not the request body
export const CreateEventBodySchema = Type.Omit(CreateEventSchema, ['created_by'], { $id: 'CreateEventBody' })
export type CreateEventBody = Static<typeof CreateEventBodySchema>

export const EventListResponseSchema = Type.Object(
  {
    data: Type.Array(EventSchema),
    total: Type.Integer(),
    page: Type.Integer(),
    limit: Type.Integer(),
  },
  { $id: 'EventListResponse' },
)

export type Event = Static<typeof EventSchema>
export type CreateEvent = Static<typeof CreateEventSchema>
export type UpdateEvent = Static<typeof UpdateEventSchema>
