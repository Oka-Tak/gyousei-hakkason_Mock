import { z } from 'zod';
import { fetchSpendingByProject } from '@/server/spendingService';
import { successResponse, validationError, internalError } from '@/server/apiResponse';

const InputSchema = z.object({
  projectId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = InputSchema.safeParse({ projectId: searchParams.get('projectId') });
    if (!input.success) {
      return validationError(input.error.issues);
    }
    const list = await fetchSpendingByProject(input.data.projectId);
    return successResponse({ spending_list: list });
  } catch (error: unknown) {
    return internalError(error);
  }
}
