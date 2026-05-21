import { Type, Static } from '@sinclair/typebox'

const ActivityBreakdownSchema = Type.Object({
  total: Type.Integer({ description: 'Total de seções no evento' }),
  by_type: Type.Record(Type.String(), Type.Integer(), {
    description: 'Contagem de seções agrupadas por tipo',
  }),
  total_workload_minutes: Type.Integer({
    description: 'Soma de workload_minutes de todas as seções',
  }),
})

export const EventMetricsSchema = Type.Object(
  {
    event_id: Type.String(),
    capacity: Type.Integer({ description: 'Capacidade total do evento' }),
    enrolled: Type.Integer({ description: 'Total de inscritos' }),
    available_spots: Type.Integer({ description: 'Vagas restantes' }),
    occupancy_percentage: Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Percentual de ocupação',
    }),
    activitys: ActivityBreakdownSchema,
  },
  { $id: 'EventMetrics' },
)

export type EventMetrics = Static<typeof EventMetricsSchema>

export const EventsMetricsSchema = Type.Object(
  {
    total_events: Type.Integer({ description: 'Total de eventos cadastrados' }),
    total_activitys: Type.Integer({ description: 'Total de seções em todos os eventos' }),
    total_capacity: Type.Integer({ description: 'Soma da capacidade de todos os eventos' }),
    total_enrolled: Type.Integer({ description: 'Total de inscrições em todos os eventos' }),
    total_available_spots: Type.Integer({ description: 'Total de vagas disponíveis' }),
    average_occupancy_percentage: Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Percentual médio de ocupação dos eventos',
    }),
    events_by_category: Type.Record(Type.String(), Type.Integer(), {
      description: 'Contagem de eventos agrupados por categoria',
    }),
    events_by_status: Type.Object(
      {
        upcoming: Type.Integer({ description: 'Eventos ainda não iniciados' }),
        ongoing: Type.Integer({ description: 'Eventos em andamento' }),
        past: Type.Integer({ description: 'Eventos encerrados' }),
      },
      { description: 'Distribuição dos eventos por status temporal' },
    ),
  },
  { $id: 'EventsMetrics' },
)

export type EventsMetrics = Static<typeof EventsMetricsSchema>
