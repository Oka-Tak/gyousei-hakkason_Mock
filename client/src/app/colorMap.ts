import * as d3 from 'd3';
import { RawProjectData } from '../types';

/**
 * データ配列からtopLevel（agency_nameまたはministry_name）ごとに色を割り当てるマップを生成
 * @param data APIから取得した全データ
 * @returns topLevel名→色のマップ
 */
export function getColorMap(data: RawProjectData[]): Record<string, string> {
  // topLevel名のリストを抽出
  const topLevels = Array.from(new Set(
    data
      .map(item => item.agency_name || item.ministry_name)
      .filter((name): name is string => Boolean(name))
  ));
  // d3.schemeTableau10の色を順に割り当て
  const colorScale = d3.scaleOrdinal<string, string>(d3.schemeTableau10);
  const colorMap: Record<string, string> = {};
  topLevels.forEach((name) => {
    colorMap[name] = colorScale(name);
  });
  return colorMap;
}
