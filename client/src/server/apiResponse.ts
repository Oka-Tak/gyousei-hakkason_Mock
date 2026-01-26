import { NextResponse } from 'next/server';
import { z } from 'zod';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiSuccessResponse<T> = T;

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export function createErrorResponse(
  code: ErrorCode,
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

export function notFoundError(message: string): NextResponse<ApiErrorResponse> {
  return createErrorResponse(ErrorCodes.NOT_FOUND, message, 404);
}

export function internalError(error: unknown): NextResponse<ApiErrorResponse> {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[API Error]', error);
  return createErrorResponse(ErrorCodes.INTERNAL_ERROR, message, 500);
}

export function serviceUnavailableError(code: string, message: string): NextResponse<ApiErrorResponse> {
  return createErrorResponse(code as ErrorCode, message, 503);
}

export function badRequestError(message: string): NextResponse<ApiErrorResponse> {
  return createErrorResponse(ErrorCodes.BAD_REQUEST, message, 400);
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(data, { status });
}
