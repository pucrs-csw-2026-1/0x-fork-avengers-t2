import { describe, it, expect, vi, beforeEach } from 'vitest'

const send = vi.fn()

vi.mock('@aws-sdk/client-sns', () => {
  return {
    SNSClient: vi.fn(() => ({ send })),
    CreateTopicCommand: vi.fn((input) => ({ input, __type: 'CreateTopic' })),
    PublishCommand: vi.fn((input) => ({ input, __type: 'Publish' })),
  }
})

describe('snsClient', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.resetModules()
  })

  async function loadClient() {
    return await import('./sns.client.js')
  }

  it('publica evento com envelope correto', async () => {
    send
      .mockResolvedValueOnce({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:eventmgmt-events' })
      .mockResolvedValueOnce({})

    const { snsClient } = await loadClient()
    await snsClient.publishEventCreated('evt_1', 'evt_1')

    expect(send).toHaveBeenCalledTimes(2)
    const publishCall = send.mock.calls[1][0]
    const envelope = JSON.parse(publishCall.input.Message)

    expect(envelope).toMatchObject({
      event_id: 'evt_1',
      event_type: 'EventCreated',
      source: 'eventmgmt-events',
      resource_ref: 'evt_1',
    })
    expect(envelope.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('cacheia o ARN do tópico entre publicações', async () => {
    send.mockResolvedValue({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:eventmgmt-events' })

    const { snsClient } = await loadClient()
    await snsClient.publishEventCreated('evt_1', 'evt_1')
    await snsClient.publishEventUpdated('evt_2', 'evt_2')

    const createTopicCalls = send.mock.calls.filter(([cmd]) => cmd.__type === 'CreateTopic')
    const publishCalls = send.mock.calls.filter(([cmd]) => cmd.__type === 'Publish')

    expect(createTopicCalls).toHaveLength(1)
    expect(publishCalls).toHaveLength(2)
  })

  it('tenta novamente e sucede após falha inicial', async () => {
    send
      .mockResolvedValueOnce({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:eventmgmt-events' })
      .mockRejectedValueOnce(new Error('throttled'))
      .mockResolvedValueOnce({})

    const { snsClient } = await loadClient()
    await snsClient.publishEventCreated('evt_1', 'evt_1')

    expect(send).toHaveBeenCalledTimes(3)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('esgota tentativas, loga erro estruturado e não lança', async () => {
    send
      .mockResolvedValueOnce({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:eventmgmt-events' })
      .mockRejectedValue(new Error('sempre falha'))

    const { snsClient } = await loadClient()
    await expect(snsClient.publishEventCreated('evt_1', 'evt_1')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledTimes(1)
    const [message, details] = vi.mocked(console.error).mock.calls[0]
    expect(message).toContain('Failed to publish domain event to SNS')
    expect(details).toMatchObject({
      event_type: 'EventCreated',
      event_id: 'evt_1',
      reason: expect.stringContaining('sempre falha'),
    })
  })

  it('falha na resolução do ARN também aciona retry e log', async () => {
    send.mockRejectedValue(new Error('create topic indisponível'))

    const { snsClient } = await loadClient()
    await expect(snsClient.publishEventUpdated('evt_9', 'evt_9')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledTimes(1)
    const [, details] = vi.mocked(console.error).mock.calls[0]
    expect(details).toMatchObject({ event_type: 'EventUpdated', event_id: 'evt_9' })
  })

  it('mapeia event_type corretamente para cada método público', async () => {
    send.mockResolvedValue({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:eventmgmt-events' })

    const { snsClient } = await loadClient()
    await snsClient.publishEventCreated('evt_1', 'evt_1')
    await snsClient.publishEventUpdated('evt_1', 'evt_1')
    await snsClient.publishEventStatusChanged('evt_1', 'evt_1')
    await snsClient.publishActivityCreated('evt_1', 'act_1')

    const publishCalls = send.mock.calls.filter(([cmd]) => cmd.__type === 'Publish')
    const eventTypes = publishCalls.map(([cmd]) => JSON.parse(cmd.input.Message).event_type)

    expect(eventTypes).toEqual([
      'EventCreated',
      'EventUpdated',
      'EventStatusChanged',
      'ActivityCreated',
    ])
  })

  it('inclui version e o payload `data` no envelope (US-08)', async () => {
    send.mockResolvedValue({ TopicArn: 'arn:aws:sns:us-east-1:000000000000:eventmgmt-events' })

    const { snsClient } = await loadClient()
    await snsClient.publishEventCreated('evt_1', 'evt_1', {
      event_id: 'evt_1',
      title: 'Congresso',
      capacity: 200,
      status: 'ativo',
    })

    const publishCall = send.mock.calls.filter(([cmd]) => cmd.__type === 'Publish')[0]
    const envelope = JSON.parse(publishCall[0].input.Message)
    expect(envelope.version).toBe('1.0')
    expect(envelope.data).toMatchObject({
      event_id: 'evt_1',
      title: 'Congresso',
      capacity: 200,
      status: 'ativo',
    })
  })
})
