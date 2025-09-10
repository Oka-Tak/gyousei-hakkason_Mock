import * as d3 from 'd3';
import { RawProjectData } from '../types';

/**
 * データ配列からtopLevel（agency_nameまたはministry_name）ごとに色を割り当てるマップを生成
 * d3.quantizeとd3.interpolateRainbowを組み合わせて、カテゴリ数に応じて均等に色を生成
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

  const n = topLevels.length;
  // カテゴリ数に応じてd3.interpolateRainbowから色を均等に抽出
  const colors = d3.quantize(d3.interpolateRainbow, n);
  
  const colorMap: Record<string, string> = {};
  topLevels.forEach((name, index) => {
    colorMap[name] = colors[index];
  });
  return colorMap;
}
