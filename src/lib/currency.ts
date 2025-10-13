export function formatCurrency(value: number, currency = 'RUB') {
  const symbol = currency === 'RUB' ? '\u20bd' : currency;
  return `${value.toLocaleString('ru-RU')} ${symbol}`;
}
