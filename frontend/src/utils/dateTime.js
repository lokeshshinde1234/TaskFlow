/** API datetimes are stored in UTC; treat missing timezone as UTC. */
export function parseApiDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw);
  }
  return new Date(`${raw}Z`);
}

export function formatLocalTime(value, options = {}) {
  const date = parseApiDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options,
  });
}

export function formatLocalDate(value, options = {}) {
  const date = parseApiDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, options);
}

export function formatLocalDateTime(value) {
  const date = parseApiDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}
