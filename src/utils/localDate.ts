export function formatLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return formatLocalDate(date) === value ? date : null;
}

export function getLocalDate(offsetDays = 0, base = new Date()): string {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  return formatLocalDate(date);
}

export function isValidDateString(value: string): boolean {
  return parseLocalDate(value) !== null;
}

export function addDaysToLocalDate(value: string, offsetDays: number): string {
  return getLocalDate(offsetDays, parseLocalDate(value) || new Date());
}

export function getRelativeDateLabel(value: string): string {
  if (value === getLocalDate()) return 'Today';
  if (value === getLocalDate(-1)) return 'Yesterday';
  if (value === getLocalDate(1)) return 'Tomorrow';
  return value;
}

export function isValidNutritionValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
