import { z } from 'zod';
import { fetchAgencyBudgetSummary } from '@/server/compareService';
import { internalError, successResponse, validationError } from '@/server/apiResponse';

const InputSchema = z.object({
  agency: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = InputSchema.safeParse({
      agency: searchParams.get('agency') || undefined,
    });
    if (!input.success) return validationError(input.error.issues);

    return successResponse(await fetchAgencyBudgetSummary(input.data.agency));
  } catch (error: unknown) {
    return internalError(error);
  }
}
