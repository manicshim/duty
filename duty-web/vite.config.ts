import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_PORT ?? 5050),
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT ?? 5050),
      strictPort: true,
    },
  };
});
