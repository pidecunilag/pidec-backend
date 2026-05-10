import { env, isDev } from '../../shared/config/env.js';
import { logger } from '../../shared/logger/index.js';

const DEFAULT_PRODUCTION_API_URL = 'https://api.pidec.com.ng';

function getKeepAliveUrl() {
  const baseUrl =
    env.KEEP_ALIVE_URL ??
    env.API_PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    (isDev ? undefined : DEFAULT_PRODUCTION_API_URL);

  if (!baseUrl) return null;

  return new URL('/api/v1/health', baseUrl).toString();
}

export function startSelfPing() {
  if (env.NODE_ENV === 'test') return;

  const url = getKeepAliveUrl();
  if (!url) {
    logger.info('Keep alive ping disabled because no public API URL is configured');
    return;
  }

  const ping = async () => {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        logger.warn({ status: response.status, url }, 'Keep alive ping returned a non-OK response');
      }
    } catch (err) {
      logger.warn({ err, url }, 'Keep alive ping failed');
    }
  };

  const interval = setInterval(ping, env.KEEP_ALIVE_INTERVAL_MS);
  interval.unref();

  logger.info({ url, intervalMs: env.KEEP_ALIVE_INTERVAL_MS }, 'Keep alive ping started');
}
