import { NextResponse } from 'next/server';
import { z } from 'zod';

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

type ApiSuccessResponse<T> = T;

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    },
    { status }
  );
}

export function validationError(issues: z.ZodIssue[]): NextResponse<ApiErrorResponse> {
  const message = issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
  return createErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    message,
    400,
    issues
  );
}

export function internalError(error: unknown): NextResponse<ApiErrorResponse> {
  const message = error instanceof Error ? error.message : String(error);
  return createErrorResponse(ErrorCodes.INTERNAL_ERROR, message, 500);
}

export function serviceUnavailableError(code: string, message: string): NextResponse<ApiErrorResponse> {
  return createErrorResponse(code, message, 503);
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(data, { status });
}
