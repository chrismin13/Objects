/**
 * iCalendar (RFC 5545) parsing and deterministic VTODO rendering for the
 * CalDAV adapter.
 *
 * Rules validated on-device (see the CalDAV spec, §8 and §11):
 * - emitted bodies always use CRLF; folded lines are unfolded on parse and
 *   LF-terminated input is tolerated;
 * - inbound DTSTAMP/LAST-MODIFIED must advance on every outbound change, so
 *   they are render-time values and excluded from the ETag hash inputs;
 * - DUE is date-only (`VALUE=DATE`) or floating wall time — never UTC;
 * - absolute-date VALARM triggers (Apple's Siri form) are read as wall time,
 *   proximity/`X-APPLE-*` alarms are ignored, one alert per to-do.
 */

const CRLF = "\r\n";

export type IcsDue = { date: string; time: string | null };

export type ParsedAlarm =
  | { kind: "relative"; seconds: number }
  | { kind: "absolute"; date: string; time: string };

export type ParsedVTodo = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  due: IcsDue | null;
  status: string | null;
  completed: string | null;
  percentComplete: number | null;
  categories: string[];
  alarm: ParsedAlarm | null;
  rrule: boolean;
};

/** Splits an iCalendar body into logical (unfolded) lines. */
export function unfoldIcs(body: string): string[] {
  const physical = body.split(/\r\n|\r|\n/);
  const lines: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }
    lines.push(line);
  }
  return lines;
}

type IcsProperty = { name: string; params: Record<string, string>; value: string };

function parseProperty(line: string): IcsProperty | null {
  const separator = line.indexOf(":");
  if (separator < 0) return null;
  const left = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const nameEnd = left.indexOf(";");
  const name = (nameEnd < 0 ? left : left.slice(0, nameEnd)).toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  if (nameEnd >= 0) {
    const paramPattern = /;([^=;]+)=("([^"]*)"|[^;]*)/g;
    let match: RegExpExecArray | null;
    while ((match = paramPattern.exec(left))) {
      params[match[1].toUpperCase()] = (match[3] ?? match[2] ?? "").toUpperCase();
    }
  }
  return { name, params, value };
}

export function unescapeIcsText(value: string): string {
  return value.replace(/\\(n|N|\\|;|,)/g, (_match, escaped: string) => {
    switch (escaped) {
      case "n":
      case "N":
        return "\n";
      case "\\":
        return "\\";
      case ";":
        return ";";
      default:
        return ",";
    }
  });
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function parseDateValue(value: string): { date: string; time: string | null } | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: null };
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:Z?)$/.exec(value);
  if (dateTime)
    return {
      date: `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`,
      time: `${dateTime[4]}:${dateTime[5]}:${dateTime[6]}`,
    };
  return null;
}

function parseDurationSeconds(value: string): number | null {
  const match = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value,
  );
  if (!match || value === "P") return null;
  const sign = match[1] === "-" ? -1 : 1;
  const weeks = Number(match[2] ?? 0);
  const days = Number(match[3] ?? 0);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  return sign * (weeks * 604800 + days * 86400 + hours * 3600 + minutes * 60 + seconds);
}

/**
 * Parses a VCALENDAR body and extracts the first VTODO. VTIMEZONE blocks and
 * `X-*` properties are ignored (the wall time of TZID-qualified values is
 * read directly, per the floating-time decision).
 */
export function parseVTodo(body: string): ParsedVTodo | null {
  const lines = unfoldIcs(body);
  let depth = "";
  let sawVtodo = false;
  let inValarm = false;
  let alarm: ParsedAlarm | null = null;
  let alarmIgnored = false;
  let alarmHasProximity = false;
  let alarmTrigger: { params: Record<string, string>; value: string } | null = null;
  const result: ParsedVTodo = {
    uid: null,
    summary: null,
    description: null,
    due: null,
    status: null,
    completed: null,
    percentComplete: null,
    categories: [],
    alarm: null,
    rrule: false,
  };

  for (const line of lines) {
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:")) {
      const component = upper.slice(6);
      if (component === "VTODO" && depth === "") {
        depth = "VTODO";
        sawVtodo = true;
      } else if (depth === "VTODO" && (component === "VALARM" || component === "VTIMEZONE")) {
        depth = component;
        inValarm = component === "VALARM";
        alarmIgnored = false;
        alarmHasProximity = false;
        alarmTrigger = null;
      }
      continue;
    }
    if (upper.startsWith("END:")) {
      const component = upper.slice(4);
      if (depth === component) {
        if (inValarm) {
          if (!alarm && !alarmIgnored && alarmTrigger) {
            const { params, value } = alarmTrigger;
            if (params["VALUE"] === "DATE-TIME") {
              // Apple's Siri form: absolute trigger, read as wall time.
              // The 1976-04-01 placeholder carries location alerts instead.
              const parsed = parseDateValue(value.replace(/Z$/, ""));
              if (
                parsed &&
                parsed.time &&
                !parsed.date.startsWith("1976-04-01") &&
                !alarmHasProximity
              )
                alarm = { kind: "absolute", date: parsed.date, time: parsed.time };
            } else if (params["X-APPLE-PROXIMITY"] || alarmHasProximity) {
              // proximity alarm — ignored
            } else {
              const seconds = parseDurationSeconds(value);
              if (seconds !== null) alarm = { kind: "relative", seconds };
            }
          }
          inValarm = false;
        }
        depth = depth === "VTODO" ? "" : "VTODO";
      }
      continue;
    }
    if (depth !== "VTODO" && !inValarm) continue;
    const property = parseProperty(line);
    if (!property) continue;

    if (inValarm) {
      if (property.name === "TRIGGER")
        alarmTrigger = { params: property.params, value: property.value };
      else if (property.name.startsWith("X-") && property.name.includes("PROXIMITY"))
        alarmHasProximity = true;
      continue;
    }

    switch (property.name) {
      case "UID":
        result.uid = property.value;
        break;
      case "SUMMARY":
        result.summary = unescapeIcsText(property.value);
        break;
      case "DESCRIPTION":
        result.description = unescapeIcsText(property.value);
        break;
      case "DUE":
        result.due = parseDateValue(property.value);
        break;
      case "STATUS":
        result.status = property.value.toUpperCase();
        break;
      case "COMPLETED":
        result.completed = property.value;
        break;
      case "PERCENT-COMPLETE":
        result.percentComplete = Number(property.value);
        break;
      case "CATEGORIES":
        for (const category of property.value.split(","))
          if (category.trim()) result.categories.push(unescapeIcsText(category.trim()));
        break;
      case "RRULE":
        result.rrule = true;
        break;
      default:
        break;
    }
  }

  result.alarm = alarm;
  return sawVtodo ? result : null;
}

function icsDate(date: string): string {
  return date.replace(/-/g, "");
}

function icsDateTime(date: string, time: string): string {
  return `${icsDate(date)}T${time.replace(/:/g, "")}`;
}

/** UTC timestamp in iCalendar form, from an ISO date-time. */
export function icsUtc(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(iso)) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

const MAX_OCTETS = 74;

function encodeChunks(value: string): number[] {
  const bytes: number[] = [];
  for (const codePoint of value) {
    for (const byte of new TextEncoder().encode(codePoint)) bytes.push(byte);
  }
  return bytes;
}

/** Folds one content line to the RFC 5545 octet limit with CRLF. */
export function foldIcsLine(line: string): string {
  const bytes = encodeChunks(line);
  if (bytes.length <= MAX_OCTETS) return line;
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + MAX_OCTETS, bytes.length);
    if (end < bytes.length) {
      // never split a multi-byte sequence
      while (end > start && (bytes[end] & 0xc0) === 0x80) end -= 1;
      if (end === start) end = Math.min(start + MAX_OCTETS, bytes.length);
    }
    parts.push(decoder.decode(new Uint8Array(bytes.slice(start, end))));
    start = end;
  }
  return parts.join(`${CRLF} `);
}

export type VTodoRenderInput = {
  uid: string;
  title: string;
  notes: string;
  /** Date-only or floating wall time; null for dateless schedules. */
  due: IcsDue | null;
  /** "NEEDS-ACTION" | "COMPLETED" */
  status: "NEEDS-ACTION" | "COMPLETED";
  /** iCalendar UTC timestamp of completion, when completed. */
  completedUtc: string | null;
  /** Completed to-dos render 100; canceled ones render no percentage. */
  percentComplete: boolean;
  categories: string[];
  /** Wall-time reminder, rendered as an at-due VALARM. */
  reminder: { date: string; time: string } | null;
  createdAtUtc: string;
  /** Render-time stamps: advance on every outbound change. */
  stampUtc: string;
};

/** Renders a complete VCALENDAR/VTODO body with CRLF line endings. */
export function renderVTodo(input: VTodoRenderInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Objects//CalDAV Adapter 1.0//EN",
    "BEGIN:VTODO",
    `UID:${input.uid}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.notes) lines.push(`DESCRIPTION:${escapeIcsText(input.notes)}`);
  if (input.due) {
    lines.push(
      input.due.time
        ? `DUE:${icsDateTime(input.due.date, input.due.time)}`
        : `DUE;VALUE=DATE:${icsDate(input.due.date)}`,
    );
  }
  lines.push(`STATUS:${input.status}`);
  if (input.status === "COMPLETED") {
    if (input.completedUtc) lines.push(`COMPLETED:${input.completedUtc}`);
    if (input.percentComplete) lines.push("PERCENT-COMPLETE:100");
  }
  if (input.categories.length)
    lines.push(`CATEGORIES:${input.categories.map(escapeIcsText).join(",")}`);
  lines.push(`CREATED:${input.createdAtUtc}`);
  lines.push(`DTSTAMP:${input.stampUtc}`);
  lines.push(`LAST-MODIFIED:${input.stampUtc}`);
  if (input.reminder) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT0S",
      `DESCRIPTION:${escapeIcsText(input.title)}`,
      "END:VALARM",
    );
  }
  lines.push("END:VTODO", "END:VCALENDAR");
  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
}

/**
 * Stable content hash of the field-relevant properties: DTSTAMP and
 * LAST-MODIFIED lines are excluded so unchanged to-dos keep stable ETags
 * while changed ones still carry fresh stamps.
 */
export function vtodoEtag(body: string): string {
  const relevant = unfoldIcs(body).filter(
    (line) => !/^DTSTAMP:/i.test(line) && !/^LAST-MODIFIED:/i.test(line),
  );
  const text = relevant.join("\n");
  // Two independent FNV-1a lanes over the whole input: ample for a content
  // hash whose only job is change detection.
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193) >>> 0;
    second ^= (code + index) & 0xffff;
    second = Math.imul(second, 0x85ebca6b) >>> 0;
  }
  return `"${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}"`;
}
