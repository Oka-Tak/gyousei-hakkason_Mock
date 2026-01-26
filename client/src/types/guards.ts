import { RawProjectData } from './index';

/**
 * Type guard to check if an object conforms to RawProjectData structure.
 * Validates essential properties used in graph data processing.
 */
export function isRawProjectData(item: unknown): item is RawProjectData {
  if (typeof item !== 'object' || item === null) {
    return false;
  }

  const obj = item as Record<string, unknown>;

  // project_id can be string, number, or undefined
  const hasValidProjectId =
    obj.project_id === undefined ||
    typeof obj.project_id === 'string' ||
    typeof obj.project_id === 'number';

  // agency_name can be string or undefined
  const hasValidAgencyName =
    obj.agency_name === undefined ||
    typeof obj.agency_name === 'string';

  // ministry_name can be string or undefined
  const hasValidMinistryName =
    obj.ministry_name === undefined ||
    typeof obj.ministry_name === 'string';

  return hasValidProjectId && hasValidAgencyName && hasValidMinistryName;
}
