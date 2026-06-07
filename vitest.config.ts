import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    env: {
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://localhost:5432/events_test',
      AUTH_SERVICE_URL: 'http://localhost:4000',
      REGISTRATION_SERVICE_URL: 'http://localhost:5000',
      POSTGRES_USER: 'events_user',
      POSTGRES_PASSWORD: 'events_pass',
      POSTGRES_DB: 'events_test',
    },
  },
})
