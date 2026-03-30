import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localFilesPlugin } from './server/middleware.js';

export default defineConfig({
  plugins: [react(), localFilesPlugin()],
});
