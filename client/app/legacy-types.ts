export type LegacyBucket = "inbox" | "today" | "upcoming" | "anytime" | "someday";

export type LegacyChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type LegacyTask = {
  id: string;
  reminderAt: string | null;
  reminderSentAt: string | null;
  checklist: LegacyChecklistItem[];
  repeat: Record<string, unknown> | null;
  headingId: string | null;
  bucket: LegacyBucket;
  scheduledFor: string | null;
  evening: boolean;
  order: number;
};

export type LegacyInterfaceState = {
  updatedAt: string;
  tasks: LegacyTask[];
};
