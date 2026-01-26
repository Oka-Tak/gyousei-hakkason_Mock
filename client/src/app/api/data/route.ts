import { fetchMainData } from '@/server/dataService';
import { successResponse, internalError } from '@/server/apiResponse';

export async function GET() {
  try {
    const rows = await fetchMainData();
    return successResponse(rows);
  } catch (error) {
    return internalError(error);
  }
}
