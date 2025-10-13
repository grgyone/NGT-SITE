export function formatCurrency(value: number, currency = 'RUB') {
  return `${value.toLocaleString('ru-RU')} ₽`;
}
