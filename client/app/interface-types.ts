export type InterfaceBucket = "inbox" | "today" | "upcoming" | "anytime" | "someday";

export type InterfaceChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type InterfaceTask = {
  id: string;
  reminderAt: string | null;
  reminderSentAt: string | null;
  checklist: InterfaceChecklistItem[];
  repeat: Record<string, unknown> | null;
  headingId: string | null;
  bucket: InterfaceBucket;
  scheduledFor: string | null;
  evening: boolean;
  order: number;
};

export type InterfaceStateSnapshot = {
  updatedAt: string;
  tasks: InterfaceTask[];
};
