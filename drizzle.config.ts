import type { Config } from 'drizzle-kit';

export default {
  schema: './src/main/database/schema.ts',
  out: './src/main/database/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './eve-inventory.db', // This will be overridden at runtime
  },
} satisfies Config;
