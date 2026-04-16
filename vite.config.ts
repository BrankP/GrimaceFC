import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

function resolveBase(repository?: string) {
  const repo = repository?.split('/')[1] ?? '';
  if (!repo) return '/';
  if (repo.toLowerCase().slice(-10) === '.github.io') return '/';
  return `/${repo}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), cloudflare()],
    base: resolveBase(env.GITHUB_REPOSITORY),
  };
});