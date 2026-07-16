import { z } from 'zod';
import { searchProjectsSemantically, OpenAIConfigError, SemanticSearchServiceError } from '@/server/semanticSearch';
import { successResponse, validationError, internalError, serviceUnavailableError, createErrorResponse } from '@/server/apiResponse';

const QuerySchema = z.object({
  q: z.string().min(1, '検索語を入力してください'),
  limit: z
    .preprocess((value) => (value === null || value === undefined || value === '' ? undefined : Number(value)), z.number().int().min(1).max(20))
    .optional(),
  threshold: z
    .preprocess((value) => (value === null || value === undefined || value === '' ? undefined : Number(value)), z.number().min(0).max(1))
    .optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');
    const rawThreshold = searchParams.get('threshold');
    const input: Record<string, string | null> = { q: searchParams.get('q') };
    if (rawLimit !== null) input.limit = rawLimit;
    if (rawThreshold !== null) input.threshold = rawThreshold;

    const parseResult = QuerySchema.safeParse(input);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues);
    }

    const matches = await searchProjectsSemantically({
      query: parseResult.data.q,
      limit: parseResult.data.limit,
      threshold: parseResult.data.threshold,
    });

    return successResponse({ matches });
  } catch (error: unknown) {
    if (error instanceof OpenAIConfigError) {
      return serviceUnavailableError('OPENAI_API_KEY_MISSING', error.message);
    }
    if (error instanceof SemanticSearchServiceError) {
      return createErrorResponse(error.code, error.message, 502);
    }
    return internalError(error);
  }
}
