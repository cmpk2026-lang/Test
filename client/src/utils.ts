export function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
