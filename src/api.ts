const API_BASE = typeof window !== 'undefined' && window.location.origin
  ? window.location.origin + '/api'
  : 'http://localhost:3001/api';

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export type Finance = {
  id: string;
  name: string;
  original_principal: number;
  remaining_principal: number;
  interest_rate: number;
  period: 'weekly' | 'monthly';
  debt_date: string;
  last_interest_calc_date: string;
  accrued_interest: number;
  total_interest_paid: number;
  total_principal_paid: number;
  status: 'active' | 'closed';
  closed_date?: string;
  created_at: string;
  // Computed by server on-the-fly
  current_interest: number;
  total_due: number;
  payments?: Payment[];
};

export type Payment = {
  id: string;
  finance_id: string;
  date: string;
  amount: number;
  to_interest: number;
  to_principal: number;
};

export async function fetchFinances(status?: string): Promise<Finance[]> {
  const query = status ? `?status=${status}` : '';
  return request(`/finances${query}`);
}

export async function fetchFinance(id: string): Promise<Finance> {
  return request(`/finances/${id}`);
}

export async function createFinance(data: {
  name: string;
  principal: number;
  interest_rate: number;
  period: 'weekly' | 'monthly';
  debt_date: string;
  previous_interest?: number;
  interest_mode?: 'auto' | 'manual';
}): Promise<Finance> {
  return request('/finances', { method: 'POST', body: JSON.stringify(data) });
}

export async function addPayment(
  financeId: string,
  data: { to_interest: number; to_principal: number }
): Promise<Finance> {
  return request(`/finances/${financeId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFinance(
  id: string,
  data: {
    name: string;
    interest_rate: number;
    period: 'weekly' | 'monthly';
    debt_date: string;
    remaining_principal: number;
  }
): Promise<Finance> {
  return request(`/finances/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteFinanceRecord(id: string): Promise<void> {
  return request(`/finances/${id}`, { method: 'DELETE' });
}

export async function updatePayment(
  financeId: string,
  paymentId: string,
  data: { to_interest: number; to_principal: number }
): Promise<Finance> {
  return request(`/finances/${financeId}/payments/${paymentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePayment(
  financeId: string,
  paymentId: string
): Promise<Finance> {
  return request(`/finances/${financeId}/payments/${paymentId}`, {
    method: 'DELETE',
  });
}
