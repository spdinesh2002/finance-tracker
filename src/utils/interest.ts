import { Finance, Period } from '../types';

export function getPeriodsElapsed(from: Date, to: Date, period: Period): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  const days = ms / (1000 * 60 * 60 * 24);
  return period === 'weekly' ? days / 7 : days / 30;
}

export function calculateCurrentInterest(finance: Finance, asOf: Date = new Date()): number {
  const lastCalc = new Date(finance.lastInterestCalcDate);
  const periods = getPeriodsElapsed(lastCalc, asOf, finance.period);
  const newInterest = finance.remainingPrincipal * (finance.interestRate / 100) * periods;
  return finance.accruedInterest + newInterest;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatCurrency(amount: number): string {
  return '\u20B9 ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
