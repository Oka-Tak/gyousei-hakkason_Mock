// Server-side constants and configuration
// Values can be overridden via environment variables

// Query limits
export const QUERY_LIMITS = {
  SPENDING_BY_PROJECT: 5000,
  COMPANY_SPENDING: 10000,
  COMPANY_BLOCKS: 10000,
  SEMANTIC_SEARCH_MAX: 20,
  SEMANTIC_SEARCH_DEFAULT: 8,
  SEMANTIC_SEARCH_MULTIPLIER: 5,
} as const;

// Cache TTL (Time-To-Live) in milliseconds
export const CACHE_TTL = {
  MAIN_DATA: Number(process.env.MAIN_DATA_TTL_MS) || 5 * 60 * 1000,
  RECIPIENT: Number(process.env.RECIPIENT_TTL_MS) || 10 * 60 * 1000,
  COMPANY: Number(process.env.COMPANY_TTL_MS) || 10 * 60 * 1000,
  SUBGRAPH: Number(process.env.SUBGRAPH_TTL_MS) || 5 * 60 * 1000,
} as const;

// Default pagination limits
export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  TOP_RESULTS_LIMIT: 6,
} as const;

// Budget year filter
export const BUDGET_YEAR = {
  CURRENT: 2024,
} as const;

// Semantic search thresholds
export const SEMANTIC_SEARCH = {
  DEFAULT_THRESHOLD: Number(process.env.PROJECT_MATCH_THRESHOLD) || 0.55,
  FALLBACK_SCORE: 0.15,
  THRESHOLDS_TO_TRY: [0.8, 0.7, 0.6, 0.5, 0.35, 0.2, 0.0] as const,
} as const;
