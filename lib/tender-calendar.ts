import type { TenderEvent } from "@/lib/tender-check";

const icsText = (value: string): string => value
  .replace(/\\/g, "\\\\")
  .replace(/;/g, "\\;")
  .replace(/,/g, "\\,")
  .replace(/\r?\n/g, "\\n");

const utcStamp = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const dateStamp = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
};

export const calendarFilename = (value: string): string => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase()
  .slice(0, 80) || "ausschreibung";

export const buildTenderCalendarIcs = (input: {
  tenderId: number;
  title: string;
  url: string;
  events: TenderEvent[];
  now?: Date;
}): string => {
  const now = input.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TenderHunter//Tender Calendar//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(input.title)}`,
  ];
  for (const event of input.events) {
    const start = new Date(event.startsAt);
    const uid = `${input.tenderId}-${event.key.replace(/[^a-zA-Z0-9_-]/g, "-")}@tenderhunter`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${icsText(uid)}`);
    lines.push(`DTSTAMP:${utcStamp(now)}`);
    lines.push(`SUMMARY:${icsText(`${event.title} - ${input.title}`)}`);
    lines.push(`DESCRIPTION:${icsText(`Ausschreibung: ${input.url}`)}`);
    lines.push(`URL:${icsText(input.url)}`);
    if (event.datePrecision === "date") {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(new Date(start.getTime() + 24 * 60 * 60 * 1000))}`);
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`);
      lines.push(`DTEND:${utcStamp(new Date(start.getTime() + 30 * 60 * 1000))}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};
