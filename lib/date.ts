function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toBkplayDate(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function toKoreanDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export function toKoreanBasisDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "";

  return `${getPart("year")}.${getPart("month")}.${getPart("day")} ${getPart("hour")}:${getPart("minute")} 기준`;
}

export function formatBkplayDate(value?: string) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return value;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function toKoreanDate(value?: string | Date) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  }).formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "";

  return `${getPart("year")}.${getPart("month")}.${getPart("day")}`;
}
