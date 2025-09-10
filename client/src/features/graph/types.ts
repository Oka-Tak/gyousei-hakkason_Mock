import * as d3 from 'd3';

export type GraphNodeDatum = d3.SimulationNodeDatum & {
  id: string;
  name: string;
  yomi?: string;
  group: string;
  value: number;
  url?: string;
  initial_budget?: number;
  topLevel: string;
  spending_list?: any[];
  project_id?: string;
};

export type GraphLinkDatum = d3.SimulationLinkDatum<GraphNodeDatum> & {
  value: number;
  source: GraphNodeDatum;
  target: GraphNodeDatum;
};

