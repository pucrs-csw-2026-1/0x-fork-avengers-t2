import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/events_test',
      AUTH_SERVICE_URL: 'http://localhost:4000',
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'password',
      POSTGRES_DB: 'events_test',
    },
  },
})
