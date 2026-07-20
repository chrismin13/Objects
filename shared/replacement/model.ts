export type EntityId = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type Outcome = "open" | "completed" | "canceled";
export type LogbookPolicy = "immediately" | "daily" | "manually";

export type Schedule =
  | { kind: "inbox" }
  | { kind: "anytime" }
  | { kind: "someday" }
  | { kind: "scheduled"; date: IsoDate; evening: boolean };

export type Reminder = {
  at: IsoDateTime;
  sentAt: IsoDateTime | null;
};

export type ToDoLocation =
  | { kind: "unfiled"; spaceId: EntityId }
  | { kind: "area"; areaId: EntityId }
  | { kind: "project"; projectId: EntityId }
  | { kind: "heading"; headingId: EntityId };

export type ProjectLocation =
  | { kind: "space"; spaceId: EntityId }
  | { kind: "area"; areaId: EntityId };

export type HeadingLocation =
  | { kind: "project"; projectId: EntityId }
  | { kind: "area"; areaId: EntityId };

export type ChecklistItem = {
  id: EntityId;
  title: string;
  completed: boolean;
  order: number;
};

export type OccurrenceLink = {
  templateId: EntityId;
  scheduledDate: IsoDate;
};

export type ToDo = {
  id: EntityId;
  title: string;
  notes: string;
  checklist: ChecklistItem[];
  location: ToDoLocation;
  schedule: Schedule;
  reminder: Reminder | null;
  deadline: IsoDate | null;
  outcome: Outcome;
  trashedAt: IsoDateTime | null;
  logbookAt: IsoDateTime | null;
  tags: EntityId[];
  occurrence: OccurrenceLink | null;
  createdAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  order: number;
};

export type Project = {
  id: EntityId;
  title: string;
  notes: string;
  location: ProjectLocation;
  schedule: Schedule;
  deadline: IsoDate | null;
  outcome: Outcome;
  trashedAt: IsoDateTime | null;
  logbookAt: IsoDateTime | null;
  tags: EntityId[];
  occurrence: OccurrenceLink | null;
  completedAt: IsoDateTime | null;
  order: number;
};

export type Area = {
  id: EntityId;
  title: string;
  spaceId: EntityId;
  color: string;
  tags: EntityId[];
  order: number;
};

export type Heading = {
  id: EntityId;
  title: string;
  location: HeadingLocation;
  archivedAt: IsoDateTime | null;
  order: number;
};

export type Space = {
  id: EntityId;
  title: string;
  color: string;
  pinned: boolean;
  order: number;
};

export type Tag = {
  id: EntityId;
  title: string;
  order: number;
};

export type CalendarEvent = {
  id: EntityId;
  spaceId: EntityId;
  title: string;
  start: IsoDateTime;
  end: IsoDateTime;
  calendar: string;
  allDay: boolean;
  sourceUid?: string | null;
};

export type RepeatingPattern = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
};

export type RepeatingProjectHeadingBlueprint = {
  key: string;
  title: string;
  archived: boolean;
  order: number;
};

export type RepeatingReminderDefault =
  | { kind: "at-time"; time: string }
  | { kind: "offset"; days: number; time: string }
  | { kind: "fixed"; at: IsoDateTime };

export type RepeatingDeadlineDefault =
  | { kind: "offset"; days: number }
  | { kind: "fixed"; date: IsoDate };

export type RepeatingProjectToDoBlueprint = {
  key: string;
  title: string;
  notes: string;
  headingKey: string | null;
  tags: EntityId[];
  checklist: Array<Omit<ChecklistItem, "id">>;
  schedule?: Exclude<Schedule, { kind: "scheduled" }> | { kind: "scheduled"; offsetDays: number; evening: boolean };
  reminder: RepeatingReminderDefault | null;
  deadline: RepeatingDeadlineDefault | null;
  order: number;
};

export type RepeatingProjectContents = {
  headings: RepeatingProjectHeadingBlueprint[];
  toDos: RepeatingProjectToDoBlueprint[];
};

type RepeatingTemplateBase = {
  id: EntityId;
  title: string;
  notes: string;
  tags: EntityId[];
  checklist: ChecklistItem[];
  pattern: RepeatingPattern;
  mode: "on-schedule" | "after-completion";
  state: "active" | "paused" | "stopped";
  firstDate?: IsoDate;
  nextDate: IsoDate;
  reminderTime: string | null;
  deadlineOffsetDays: number | null;
  createdAt: IsoDateTime;
};

export type RepeatingTemplate = RepeatingTemplateBase & (
  | { itemKind: "toDo"; location: ToDoLocation; projectContents: null }
  | { itemKind: "project"; location: ProjectLocation; projectContents: RepeatingProjectContents }
);

export type RepeatingPreview = {
  id: string;
  templateId: EntityId;
  itemKind: RepeatingTemplate["itemKind"];
  title: string;
  scheduledDate: IsoDate;
};

export type ProjectClosure = {
  id: EntityId;
  projectId: EntityId;
  projectOutcome: Exclude<Outcome, "open">;
  changedToDoIds: EntityId[];
  closedAt: IsoDateTime;
};

export type LaunchRule = {
  id: EntityId;
  spaceId: EntityId;
  weekdays: number[];
  start: string;
  end: string;
  order: number;
};

export type WorkspaceSettings = {
  theme: "system" | "light" | "dark";
  groupToday: boolean;
  notifications: boolean;
  weekStartsOn: 0 | 1;
  showCalendar: boolean;
  logCompletedItems: LogbookPolicy;
  defaultSpaceId: EntityId | null;
  launchRules: LaunchRule[];
  quickDraft: {
    value: string;
    updatedAt?: IsoDateTime;
    viewType?: string;
    viewId?: string | null;
    sectionKey?: string;
  } | null;
};

export type PermanentDeletion = {
  entityKind: "toDo" | "project" | "area" | "heading" | "space" | "tag" | "repeatingTemplate" | "calendarEvent";
  entityId: EntityId;
  deletedAt: IsoDateTime;
};

export type SyncMetadata = {
  revision: number;
  lastMutationId: string | null;
  updatedAt: IsoDateTime;
  legacyMigration?: {
    updatedAt: IsoDateTime;
    mutationId: string;
  };
};

export type CaptureReceipt = {
  submissionId: string;
  toDoId: EntityId;
  createdAt: IsoDateTime;
};

export type WorkspaceDocument = {
  format: "objects-workspace";
  version: 1;
  settings: WorkspaceSettings;
  spaces: Space[];
  areas: Area[];
  projects: Project[];
  headings: Heading[];
  tags: Tag[];
  toDos: ToDo[];
  repeatingTemplates: RepeatingTemplate[];
  projectClosures: ProjectClosure[];
  calendarEvents: CalendarEvent[];
  permanentDeletions: PermanentDeletion[];
  captureReceipts: CaptureReceipt[];
  sync: SyncMetadata;
};

export type WorkspaceEntityKind =
  | "toDo"
  | "checklistItem"
  | "project"
  | "area"
  | "heading"
  | "space"
  | "tag"
  | "repeatingTemplate"
  | "calendarEvent";

export type AffectedEntity = { kind: WorkspaceEntityKind; id: EntityId };

export type WorkspaceUndo = {
  token: string;
  label: string;
};

export type WorkspaceChangeResult =
  | {
      status: "changed";
      outcome: string;
      affected: AffectedEntity[];
      undo: WorkspaceUndo | null;
    }
  | {
      status: "rejected";
      outcome: "validation-failed" | "not-found" | "undo-unavailable" | "confirmation-required" | "import-rejected";
      affected: [];
      undo: null;
      errors: string[];
    };
