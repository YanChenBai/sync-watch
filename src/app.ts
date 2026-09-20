import { staticPlugin } from '@elysia/static';
import { Elysia } from 'elysia';

import { createIceConfig } from './ice.ts';
import { signaling } from './signaling.ts';

export async function createApp() {
  const assets = await staticPlugin({
    assets: 'public',
    prefix: '/',
    bunFullstack: true,
  });

  return new Elysia()
    .get('/api/ice', () => createIceConfig())
    .use(signaling)
    .use(assets);
}
