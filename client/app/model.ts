import type { LegacyBucket } from "./legacy-types";

export type ParsedTask = {
  title: string;
  bucket: LegacyBucket | null;
  scheduledFor: string | null;
  deadline: string | null;
  evening: boolean;
  reminderAt: string | null;
  tags: string[];
};

function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDay(date);
}

const NATURAL_DATE_SOURCE = [
  "tod(?:ay)?", "tom(?:orrow)?", "tonight", "this\\s+eve(?:ning)?", "eve(?:ning)?", "next\\s+week", "someday",
  "\\d+\\s*(?:d|days?|w|weeks?|mo|months?|y|years?)\\s+from\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*\\d{1,2}",
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*\\d{1,2}\\s*\\+\\s*\\d+\\s*(?:d|days?|w|weeks?|mo|months?|y|years?)",
  "(?:\\d+(?:st|nd|rd|th)|last)\\s+(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\\s+\\d{4})?",
  "(?:in\\s+)?\\d+\\s*(?:d|days?|w|weeks?|mo|months?|y|years?)",
  "(?:next\\s+)?(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)",
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*\\d{1,2}(?:,?\\s*\\d{4})?",
  "\\d{4}-\\d{2}-\\d{2}", "\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?",
].join("|");

function naturalTime(hourValue: string, minuteValue = "0", meridiemValue = ""): string | null {
  let hour = Number(hourValue);
  const minute = Number(minuteValue || 0);
  const meridiem = meridiemValue.toLowerCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (meridiem.startsWith("p") && hour < 12) hour += 12;
  if (meridiem.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || (meridiem && Number(hourValue) > 12)) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function offsetNaturalDate(day: string, amountValue: string, unitValue: string): string | null {
  const amount = Number(amountValue);
  const unit = unitValue.toLowerCase();
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(amount) || Number.isNaN(date.getTime())) return null;
  if (/^d/.test(unit)) date.setDate(date.getDate() + amount);
  else if (/^w/.test(unit)) date.setDate(date.getDate() + amount * 7);
  else if (/^mo/.test(unit)) {
    const targetDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(targetDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else {
    const month = date.getMonth();
    const targetDay = date.getDate();
    date.setDate(1);
    date.setFullYear(date.getFullYear() + amount);
    date.setMonth(month);
    date.setDate(Math.min(targetDay, new Date(date.getFullYear(), month + 1, 0).getDate()));
  }
  return localDay(date);
}

function nextWeekday(name: string, today: string): string | null {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const target = days.indexOf(days.find((day) => day.startsWith(name.slice(0, 3))) || name);
  if (target < 0) return null;
  const date = new Date(`${today}T12:00:00`);
  let distance = (target - date.getDay() + 7) % 7;
  if (distance === 0) distance = 7;
  return addDays(today, distance);
}

export function parseNaturalDate(phrase: string | null | undefined, today = localDay(), weekStartsOn: 0 | 1 = 1): string | null {
  const value = String(phrase || "").trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
  const relativeFrom = value.match(/^(\d+)\s*(d|days?|w|weeks?|mo|months?|y|years?)\s+from\s+(.+)$/);
  if (relativeFrom) {
    const base = parseNaturalDate(relativeFrom[3], today, weekStartsOn);
    return base ? offsetNaturalDate(base, relativeFrom[1], relativeFrom[2]) : null;
  }
  const relativePlus = value.match(/^(.+?)\s*\+\s*(\d+)\s*(d|days?|w|weeks?|mo|months?|y|years?)$/);
  if (relativePlus) {
    const base = parseNaturalDate(relativePlus[1], today, weekStartsOn);
    return base ? offsetNaturalDate(base, relativePlus[2], relativePlus[3]) : null;
  }
  if (["today", "tod", "tonight", "evening", "eve", "this evening", "this eve"].includes(value)) return today;
  if (["tomorrow", "tom"].includes(value)) return addDays(today, 1);
  if (value === "next week") {
    const date = new Date(`${today}T12:00:00`);
    let distance = (weekStartsOn - date.getDay() + 7) % 7;
    if (distance === 0) distance = 7;
    return addDays(today, distance);
  }
  const weekday = value.match(/^(?:next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)$/);
  if (weekday) return nextWeekday(weekday[1], today);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const candidate = new Date(`${value}T12:00:00`);
    return Number.isNaN(candidate.getTime()) || localDay(candidate) !== value ? null : value;
  }
  const ordinalWeekday = value.match(/^(?:(\d+)(?:st|nd|rd|th)|(last))\s+(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?$/);
  if (ordinalWeekday) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const month = months.indexOf(ordinalWeekday[4].slice(0, 3));
    const targetDay = days.findIndex((day) => day.startsWith(ordinalWeekday[3].slice(0, 3)));
    const explicitYear = Number(ordinalWeekday[5]) || null;
    let year = explicitYear || new Date(`${today}T12:00:00`).getFullYear();
    const calculate = (): Date | null => {
      if (ordinalWeekday[2]) {
        const candidate = new Date(year, month + 1, 0, 12);
        candidate.setDate(candidate.getDate() - ((candidate.getDay() - targetDay + 7) % 7));
        return candidate;
      }
      const candidate = new Date(year, month, 1, 12);
      candidate.setDate(1 + ((targetDay - candidate.getDay() + 7) % 7) + (Number(ordinalWeekday[1]) - 1) * 7);
      return candidate.getMonth() === month ? candidate : null;
    };
    let candidate = calculate();
    if (!explicitYear && candidate && localDay(candidate) < today) { year += 1; candidate = calculate(); }
    return candidate ? localDay(candidate) : null;
  }
  const namedDate = value.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:\s*(\d{4}))?$/);
  if (namedDate) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(namedDate[1].slice(0, 3));
    const explicitYear = Number(namedDate[3]) || null;
    const candidate = new Date(explicitYear || new Date(`${today}T12:00:00`).getFullYear(), month, Number(namedDate[2]), 12);
    if (!explicitYear && localDay(candidate) < today) candidate.setFullYear(candidate.getFullYear() + 1);
    return localDay(candidate);
  }
  const numericDate = value.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (numericDate) {
    const currentYear = new Date(`${today}T12:00:00`).getFullYear();
    let year = Number(numericDate[3]) || currentYear;
    if (year < 100) year += 2000;
    const candidate = new Date(year, Number(numericDate[1]) - 1, Number(numericDate[2]), 12);
    if (!numericDate[3] && localDay(candidate) < today) candidate.setFullYear(candidate.getFullYear() + 1);
    return localDay(candidate);
  }
  const relative = value.match(/^(?:in\s+)?(\d+)\s*(d|days?|w|weeks?|mo|months?|y|years?)$/);
  return relative ? offsetNaturalDate(today, relative[1], relative[2]) : null;
}

export function parseNaturalTask(raw: string, today = localDay(), weekStartsOn: 0 | 1 = 1): ParsedTask {
  let title = raw.trim();
  const result: ParsedTask = { title, bucket: null, scheduledFor: null, evening: false, reminderAt: null, deadline: null, tags: [] };
  result.tags = [...title.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1]);
  title = title.replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu, " ").replace(/\s+/g, " ").trim();
  const deadlineMatch = title.match(new RegExp(`\\s(?:deadline|due)\\s+(${NATURAL_DATE_SOURCE})(?=\\s|$)`, "i"));
  if (deadlineMatch) {
    result.deadline = parseNaturalDate(deadlineMatch[1], today, weekStartsOn) || deadlineMatch[1];
    title = title.replace(deadlineMatch[0], "").trim();
  }
  const dateMatch = title.match(new RegExp(`\\s(${NATURAL_DATE_SOURCE})(?:\\s+(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(a|am|p|pm)?)?\\s*$`, "i"));
  if (dateMatch) {
    const phrase = dateMatch[1].toLowerCase();
    if (phrase === "someday") result.bucket = "someday";
    else {
      result.scheduledFor = parseNaturalDate(phrase, today, weekStartsOn);
      result.bucket = result.scheduledFor === today ? "today" : "upcoming";
      result.evening = ["tonight", "evening", "eve", "this evening", "this eve"].includes(phrase);
    }
    if (dateMatch[2] && result.scheduledFor) {
      const time = naturalTime(dateMatch[2], dateMatch[3], dateMatch[4]);
      if (time) result.reminderAt = `${result.scheduledFor}T${time}`;
    }
    title = title.replace(dateMatch[0], "").trim();
  }
  if (!result.reminderAt) {
    const timeOnly = title.match(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)\s*$/i);
    if (timeOnly) {
      const time = naturalTime(timeOnly[1], timeOnly[2], timeOnly[3]);
      if (time) {
        result.scheduledFor = today;
        result.bucket = "today";
        result.reminderAt = `${today}T${time}`;
        title = title.replace(timeOnly[0], "").trim();
      }
    }
  }
  result.title = title || raw.trim();
  return result;
}
