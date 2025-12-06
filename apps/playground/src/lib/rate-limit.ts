import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Check if Upstash is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
)

// Create rate limiter instance only if configured
// Allows 10 requests per IP per hour (sliding window)
export const ratelimit = isUpstashConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'manifesto-playground',
    })
  : null

// Helper to get IP from request
export function getIP(req: Request): string {
  // Try various headers for IP detection
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]
    if (ip) return ip.trim()
  }

  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Vercel-specific header
  const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    const ip = vercelForwardedFor.split(',')[0]
    if (ip) return ip.trim()
  }

  // Fallback for development
  return '127.0.0.1'
}

// Rate limit check result type
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Check rate limit for an IP
// Returns success: true if rate limiting is disabled (local dev)
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  // Skip rate limiting in local development
  if (!ratelimit) {
    return {
      success: true,
      limit: -1,
      remaining: -1,
      reset: Date.now() + 3600000,
    }
  }

  const { success, limit, remaining, reset } = await ratelimit.limit(ip)
  return { success, limit, remaining, reset }
}
