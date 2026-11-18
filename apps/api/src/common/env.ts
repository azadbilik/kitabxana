const PLACEHOLDER = /^change-me/i;

/**
 * Checked once at boot (ConfigModule `validate`), so a missing variable stops the start
 * with a readable message instead of failing on the first request that needs it.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const has = (name: string) => typeof env[name] === 'string' && (env[name] as string).trim() !== '';
  const production = env.NODE_ENV === 'production';
  const problems: string[] = [];

  for (const name of ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!has(name)) problems.push(`${name} is not set`);
  }
  if (production) {
    for (const name of ['SITE_URL', 'CORS_ORIGIN']) {
      if (!has(name)) problems.push(`${name} is not set (required when NODE_ENV=production)`);
    }
    for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      const value = has(name) ? String(env[name]) : '';
      if (value && (value.length < 32 || PLACEHOLDER.test(value))) {
        problems.push(`${name} must be a random secret of at least 32 characters in production (openssl rand -hex 32)`);
      }
    }
  }
  if (has('TELEGRAM_POST_HOUR')) {
    const hour = Number(env.TELEGRAM_POST_HOUR);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) problems.push('TELEGRAM_POST_HOUR must be an hour from 0 to 23');
  }

  if (problems.length) {
    throw new Error(`Invalid environment:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
  return env;
}
