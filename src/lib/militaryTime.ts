/** UI stays colon-free; existing clock/date storage keeps HH:mm. */
export function militaryDigits(value: string) {
  const colon = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (colon) return `${colon[1].padStart(2, '0')}${colon[2]}`;
  return value;
}
export function normalizeMilitary(value: string) {
  const digits = militaryDigits(value.trim());
  return /^\d{3}$/.test(digits) ? digits.padStart(4, '0') : digits;
}
export function validMilitary(value: string) {
  return /^(?:[01]\d|2[0-3])[0-5]\d$/.test(normalizeMilitary(value));
}
export function clockValue(value: string) {
  const digits = normalizeMilitary(value);
  return validMilitary(digits) ? `${digits.slice(0, 2)}:${digits.slice(2)}` : value;
}