export type TaskStatus = "todo" | "in-progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type ViewMode = "todo" | "kanban" | "table" | "trash";

export type DateFilterField = "dueDate" | "createdAt";

export type DateFilterType = "all" | "today" | "week" | "month" | "custom";

export interface DateFilter {
  field: DateFilterField;
  type: DateFilterType;
  startDate?: Date;
  endDate?: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tone?: "default" | "muted";
}
