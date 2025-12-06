import type { SemanticSnapshot } from '@manifesto-ai/ai-util'
import { createFormAgentStream } from '@/lib/form-agent'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    // Rate limiting check
    const ip = getIP(req)
    const { success, remaining, reset } = await checkRateLimit(ip)

    if (!success) {
      const resetDate = new Date(reset)
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You have exceeded the rate limit. Please try again after ${resetDate.toLocaleTimeString()}.`,
          remaining: 0,
          resetAt: reset,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      )
    }

    const body = await req.json()
    const messages = body.messages
    const schemaContext = body.schemaContext as { viewId?: string; entityId?: string } | undefined
    const snapshot = body.snapshot as SemanticSnapshot | null | undefined

    // Create streaming response using form agent
    const result = createFormAgentStream(
      { snapshot: snapshot ?? null, schemaContext },
      messages
    )

    const response = result.toDataStreamResponse()

    // Add rate limit headers to successful response
    response.headers.set('X-RateLimit-Limit', '10')
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', reset.toString())

    return response
  } catch (error) {
    console.error('Chat API error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : 'Unknown',
    })

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorStack,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
