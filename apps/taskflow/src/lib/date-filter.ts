import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { DateFilter, DateFilterType, Task } from "@/types/taskflow";

export function getDateRangeFromType(
  type: DateFilterType,
): { startDate: Date; endDate: Date } | null {
  const now = new Date();

  switch (type) {
    case "today":
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case "week":
      return {
        startDate: startOfWeek(now, { weekStartsOn: 0 }),
        endDate: endOfWeek(now, { weekStartsOn: 0 }),
      };
    case "month":
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    default:
      return null;
  }
}

export function filterTasksByDate(
  tasks: Task[],
  dateFilter: DateFilter | null,
): Task[] {
  if (!dateFilter || dateFilter.type === "all") {
    return tasks;
  }

  let startDate: Date;
  let endDate: Date;

  if (
    dateFilter.type === "custom" &&
    dateFilter.startDate &&
    dateFilter.endDate
  ) {
    startDate = dateFilter.startDate;
    endDate = dateFilter.endDate;
  } else {
    const range = getDateRangeFromType(dateFilter.type);
    if (!range) {
      return tasks;
    }
    startDate = range.startDate;
    endDate = range.endDate;
  }

  return tasks.filter((task) => {
    const dateValue =
      dateFilter.field === "dueDate" ? task.dueDate : task.createdAt;

    if (!dateValue) {
      return false;
    }

    return isWithinInterval(parseISO(dateValue), {
      start: startDate,
      end: endDate,
    });
  });
}

export function formatTaskDate(value: string | null, fallback = "-"): string {
  if (!value) {
    return fallback;
  }

  return format(parseISO(value), "MMM d, yyyy");
}
