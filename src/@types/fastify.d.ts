import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      scopes: string[]
      principalType: 'user' | 'service'
    }
  }
}
