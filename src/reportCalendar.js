/** Identifica domingos con fecha civil ISO, sin depender de la zona horaria del navegador. */
export function isSundayISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value && parsed.getUTCDay() === 0;
}
