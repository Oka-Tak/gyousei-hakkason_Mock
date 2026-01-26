import { z } from 'zod';
import { fetchSubgraph } from '@/server/subgraphService';
import { successResponse, validationError, internalError } from '@/server/apiResponse';

const SubgraphInputSchema = z.object({
  node: z.string().min(1, 'node parameter is required'),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = SubgraphInputSchema.safeParse({ node: searchParams.get('node') });

    if (!input.success) {
      return validationError(input.error.issues);
    }

    const nodeId = input.data.node;
    const data = await fetchSubgraph(nodeId);
    return successResponse(data);
  } catch (error: unknown) {
    return internalError(error);
  }
}
