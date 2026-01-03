/**
 * Simple Intent API Route
 *
 * HTTP 어댑터 - 비즈니스 로직은 agent-simple 모듈에 위임
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processSimpleIntent,
  toResponse,
  isOk,
  isErr,
  toHttpStatus,
  type SimpleAgentResponse,
} from '@/lib/agent-simple';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await processSimpleIntent(body);
    const response = toResponse(result);

    const status = isErr(result) ? toHttpStatus(result.error) : 200;
    return NextResponse.json<SimpleAgentResponse>(response, { status });
  } catch (error) {
    // JSON 파싱 실패 등 예외 처리
    return NextResponse.json<SimpleAgentResponse>(
      {
        success: false,
        intent: null,
        effects: [],
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
