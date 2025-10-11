export function formatCurrency(value: number, currency = 'RUB') {
  return `${value.toLocaleString('ru-RU')} \u20bd`;
}
