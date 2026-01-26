import { z } from 'zod';
import { fetchTopRecipientsByAgency } from '@/server/insightService';
import { successResponse, validationError, internalError } from '@/server/apiResponse';
import { PAGINATION } from '@/server/constants';

const Schema = z.object({ agency: z.string().min(1), limit: z.coerce.number().min(1).max(50).optional() });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = Schema.safeParse({ agency: searchParams.get('agency'), limit: searchParams.get('limit') });
    if (!input.success) return validationError(input.error.issues);
    const data = await fetchTopRecipientsByAgency(input.data.agency, input.data.limit ?? PAGINATION.DEFAULT_LIMIT);
    return successResponse({ recipients: data });
  } catch (error: unknown) {
    return internalError(error);
  }
}

