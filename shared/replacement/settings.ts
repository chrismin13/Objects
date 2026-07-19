import type { WorkspaceDocument } from "./model.ts";

export type DeviceSpacePreferences = {
  launchRulesEnabled: boolean;
  manualSpaceId: string | null;
};

export function shouldRememberManualSpace(targetKind: string, usedDirectNavigation: boolean): boolean {
  return usedDirectNavigation && targetKind === "space";
}

export function resolveAppearance(
  theme: WorkspaceDocument["settings"]["theme"],
  systemUsesDark: boolean,
): "light" | "dark" {
  if (theme === "system") return systemUsesDark ? "dark" : "light";
  return theme;
}

function minutesFromClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function ruleMatches(rule: WorkspaceDocument["settings"]["launchRules"][number], date: Date): boolean {
  const start = minutesFromClock(rule.start);
  const end = minutesFromClock(rule.end);
  if (start === null || end === null || start === end || !rule.weekdays.length) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  if (start < end) return rule.weekdays.includes(date.getDay()) && now >= start && now < end;
  if (now >= start) return rule.weekdays.includes(date.getDay());
  const previousDay = (date.getDay() + 6) % 7;
  return now < end && rule.weekdays.includes(previousDay);
}

export function selectLaunchSpace(
  document: WorkspaceDocument,
  preferences: DeviceSpacePreferences,
  date: Date,
): string | null {
  const availableSpaceIds = new Set(document.spaces.map((space) => space.id));
  const defaultSpaceId = document.settings.defaultSpaceId && availableSpaceIds.has(document.settings.defaultSpaceId)
    ? document.settings.defaultSpaceId
    : document.spaces[0]?.id ?? null;

  if (preferences.launchRulesEnabled) {
    const match = [...document.settings.launchRules]
      .sort((left, right) => left.order - right.order)
      .find((rule) => availableSpaceIds.has(rule.spaceId) && ruleMatches(rule, date));
    return match?.spaceId ?? defaultSpaceId;
  }

  return preferences.manualSpaceId && availableSpaceIds.has(preferences.manualSpaceId)
    ? preferences.manualSpaceId
    : defaultSpaceId;
}
