import { defineConfig } from '@neon/cli';

export default defineConfig({
  services: [
    {
      name: 'postgres',
      type: 'postgres',
    },
  ],
});
