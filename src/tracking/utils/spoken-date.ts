function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

// Voice-agent-ready date, e.g. "2026-09-30" -> "September 30th".
export function toSpokenDate(eta: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eta);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }

  const monthName = date.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${monthName} ${day}${ordinalSuffix(day)}`;
}
