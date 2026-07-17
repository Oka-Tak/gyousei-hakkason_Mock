import { fetchAgencyNames } from '@/server/agencyService';
import { internalError, successResponse } from '@/server/apiResponse';

export async function GET() {
  try {
    return successResponse(await fetchAgencyNames());
  } catch (error: unknown) {
    return internalError(error);
  }
}
