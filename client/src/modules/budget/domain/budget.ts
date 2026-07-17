export interface BudgetBreakdown {
  initial: number | null | undefined;
  adjustment: number | null | undefined;
  carryover: number | null | undefined;
  contingency: number | null | undefined;
}

function finiteAmount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function calculateTotalBudget(budget: BudgetBreakdown): number {
  return finiteAmount(budget.initial)
    + finiteAmount(budget.adjustment)
    + finiteAmount(budget.carryover)
    + finiteAmount(budget.contingency);
}
