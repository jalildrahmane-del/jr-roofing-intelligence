const ukCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function ukSiteDate(now = new Date()): string {
  return ukCalendar.format(now);
}
