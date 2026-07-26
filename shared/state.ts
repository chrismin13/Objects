/**
 * Legacy interface-state types for the UI feature components.
 *
 * The interface the client renders is a loose, view-shaped projection of the
 * Workspace domain (see shared/workspace/interface-bridge.ts). These types
 * describe that projection for the dialog components; they are deliberately
 * field-minimal — the components only touch what is declared here.
 */

export type Space = {
  id: string;
  title: string;
  color: string;
  pinned?: boolean;
  order?: number;
};

export type Area = {
  id: string;
  title: string;
  spaceId: string;
  color?: string;
  tags?: string[];
  order?: number;
};

export type Heading = {
  id: string;
  title: string;
  order?: number;
  archived?: boolean;
};

export type Project = {
  id: string;
  title: string;
  notes?: string;
  status?: string;
  areaId?: string | null;
  spaceId?: string | null;
  deadline?: string | null;
  scheduledFor?: string | null;
  bucket?: string;
  tags?: string[];
  repeat?: RepeatRule | null;
  repeatTemplateId?: string | null;
  order?: number;
  archived?: boolean;
};

export type RepeatRule = {
  mode: "fixed" | "afterCompletion";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  nextDate: string;
  reminderTime?: string | null;
  deadlineOffset?: number | null;
  paused: boolean;
  stopped?: boolean;
  workspaceTemplateId?: string;
};

export type LaunchRule = {
  id: string;
  spaceId: string;
  weekdays: number[];
  start: string;
  end: string;
  order?: number;
};

export type ObjectsSettings = {
  theme: "system" | "light" | "dark";
  groupToday: boolean;
  notifications: boolean;
  weekStartsOn: 0 | 1;
  showCalendar: boolean;
  logCompletedItems: "immediately" | "daily" | "manually";
};
