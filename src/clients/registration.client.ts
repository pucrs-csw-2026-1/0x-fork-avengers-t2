import { env } from '../config/env.js'

const TIMEOUT_MS = 5000

export const registrationClient = {
  async getRegistrationCountByEvent(eventId: string): Promise<number> {
    const baseUrl = env.REGISTRATION_SERVICE_URL
    if (!baseUrl) return 0

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${baseUrl}/events/${eventId}/registrations`, {
        signal: controller.signal,
      })
      if (!res.ok) return 0
      const data: unknown = await res.json()
      if (Array.isArray(data)) return data.length
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>
        if (typeof obj.total === 'number') return obj.total
        if (typeof obj.count === 'number') return obj.count
      }
      return 0
    } catch {
      return 0
    } finally {
      clearTimeout(timeout)
    }
  },

  async getTotalEnrolled(eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) return 0
    const counts = await Promise.all(
      eventIds.map((id) => registrationClient.getRegistrationCountByEvent(id)),
    )
    return counts.reduce((sum, n) => sum + n, 0)
  },
}
