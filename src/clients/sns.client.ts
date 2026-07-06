import { SNSClient, CreateTopicCommand, PublishCommand } from '@aws-sdk/client-sns'
import { env } from '../config/env.js'

const TOPIC_NAME = 'eventmgmt-events'
const RETRY_DELAYS_MS = [200, 400]

export type DomainEventType = 'EventCreated' | 'EventUpdated' | 'ActivityCreated'

export interface DomainEventEnvelope {
  event_id: string
  event_type: DomainEventType
  source: string
  occurred_at: string
  resource_ref: string
}

let client: SNSClient | undefined
let cachedTopicArn: string | undefined

function getClient(): SNSClient {
  if (!client) {
    client = new SNSClient({
      region: env.AWS_REGION,
      ...(env.AWS_ENDPOINT_URL ? { endpoint: env.AWS_ENDPOINT_URL } : {}),
    })
  }
  return client
}

async function resolveTopicArn(): Promise<string> {
  if (cachedTopicArn) return cachedTopicArn

  const result = await getClient().send(new CreateTopicCommand({ Name: TOPIC_NAME }))
  if (!result.TopicArn) throw new Error('CreateTopicCommand did not return a TopicArn')

  cachedTopicArn = result.TopicArn
  return cachedTopicArn
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildEnvelope(eventType: DomainEventType, eventId: string, resourceRef: string): DomainEventEnvelope {
  return {
    event_id: eventId,
    event_type: eventType,
    source: TOPIC_NAME,
    occurred_at: new Date().toISOString(),
    resource_ref: resourceRef,
  }
}

async function publish(eventType: DomainEventType, eventId: string, resourceRef: string): Promise<void> {
  const envelope = buildEnvelope(eventType, eventId, resourceRef)
  let lastError: unknown

  for (let attempt = 0; attempt < 1 + RETRY_DELAYS_MS.length; attempt++) {
    try {
      const topicArn = await resolveTopicArn()
      await getClient().send(new PublishCommand({ TopicArn: topicArn, Message: JSON.stringify(envelope) }))
      return
    } catch (err) {
      lastError = err
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  console.error('Failed to publish domain event to SNS', {
    event_type: eventType,
    event_id: eventId,
    reason: lastError instanceof Error ? lastError.message : String(lastError),
  })
}

export const snsClient = {
  async publishEventCreated(eventId: string, resourceRef: string): Promise<void> {
    await publish('EventCreated', eventId, resourceRef)
  },

  async publishEventUpdated(eventId: string, resourceRef: string): Promise<void> {
    await publish('EventUpdated', eventId, resourceRef)
  },

  async publishActivityCreated(eventId: string, resourceRef: string): Promise<void> {
    await publish('ActivityCreated', eventId, resourceRef)
  },
}
