/**
 * Calculate interest on-the-fly. Never stored — always computed from:
 *   - remaining_principal
 *   - interest_rate
 *   - period (weekly/monthly)
 *   - last_interest_calc_date
 *   - accrued_interest (unpaid interest from previous settlements)
 */

function getPeriodsElapsed(fromDate, toDate, period) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  const days = ms / (1000 * 60 * 60 * 24);
  return period === 'weekly' ? days / 7 : days / 30;
}

function calculateCurrentInterest(finance) {
  const now = new Date();
  const periods = getPeriodsElapsed(finance.last_interest_calc_date, now, finance.period);
  const newInterest = finance.remaining_principal * (finance.interest_rate / 100) * periods;
  return Math.round((finance.accrued_interest + newInterest) * 100) / 100;
}

function enrichWithInterest(finance) {
  const currentInterest = calculateCurrentInterest(finance);
  return {
    ...finance,
    current_interest: currentInterest,
    total_due: Math.round((finance.remaining_principal + currentInterest) * 100) / 100,
  };
}

module.exports = { getPeriodsElapsed, calculateCurrentInterest, enrichWithInterest };
