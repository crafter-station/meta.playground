import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (_ratelimit) return _ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || !url.startsWith("https")) return null;

  _ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(5, "1 d"),
    analytics: true,
  });

  return _ratelimit;
}

export async function checkRateLimit(identifier: string) {
  const rl = getRatelimit();
  if (!rl) return { success: true, limit: 0, remaining: 0, reset: 0 };
  return rl.limit(identifier);
}
