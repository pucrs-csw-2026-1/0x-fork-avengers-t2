import { Type, Static } from '@sinclair/typebox'

export const ActivitySchema = Type.Object(
  {
    id_activity: Type.String({ examples: ['sec_01hw'] }),
    title_activity: Type.String(),
    description_activity: Type.Optional(Type.String()),
    type: Type.String({ examples: ['palestra', 'workshop', 'mesa_redonda'] }),
    starts_at: Type.String({ format: 'date-time' }),
    ends_at: Type.String({ format: 'date-time' }),
    timezone: Type.String({ examples: ['America/Sao_Paulo'] }),
    registration_deadline_activity: Type.Optional(Type.String({ format: 'date-time' })),
    thumbnail_url: Type.Optional(Type.String({ format: 'uri' })),
    capacity_activity: Type.Optional(Type.Integer({ minimum: 1 })),
    workload_minutes: Type.Integer({
      minimum: 1,
      description: 'Carga horária em minutos — obrigatório para emissão de certificado',
    }),
    category_activity: Type.Optional(Type.String()),
    language_activity: Type.Optional(Type.String({ examples: ['pt-BR'] })),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
    deleted_at: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    deleted_by: Type.Union([Type.String(), Type.Null()]),
    created_by: Type.String(),
  },
  { $id: 'Activity' },
)

export type Activity = Static<typeof ActivitySchema>
