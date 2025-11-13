import { RawProjectData } from './index';

// 型ガード関数
export function isRawProjectData(item: any): item is RawProjectData {
  return typeof item === 'object' && 
         item !== null &&
         (typeof item.project_id === 'string' || typeof item.project_id === 'number' || item.project_id === undefined) &&
         (typeof item.agency_name === 'string' || item.agency_name === undefined) &&
         (typeof item.ministry_name === 'string' || item.ministry_name === undefined);
}
