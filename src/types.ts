export type Period = 'weekly' | 'monthly';

export type Payment = {
  id: string;
  date: string;
  amount: number;
  toInterest: number;
  toPrincipal: number;
};

export type Finance = {
  id: string;
  name: string;
  originalPrincipal: number;
  remainingPrincipal: number;
  interestRate: number;
  period: Period;
  startDate: string;
  lastInterestCalcDate: string;
  accruedInterest: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  payments: Payment[];
  status: 'active' | 'closed';
  closedDate?: string;
};
