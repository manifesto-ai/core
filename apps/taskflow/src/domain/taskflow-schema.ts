/**
 * MEL domain source for TaskFlow.
 *
 * The canonical definition lives in taskflow.mel (used by tests via readFileSync).
 * This module re-exports it as a string constant for the Next.js client bundle,
 * avoiding the need for a custom Turbopack loader.
 */
export const TASKFLOW_MEL = `\
domain TaskFlow {
  type Task = {
    id: string,
    title: string,
    description: string | null,
    status: "todo" | "in-progress" | "review" | "done",
    priority: "low" | "medium" | "high",
    assignee: string | null,
    dueDate: string | null,
    tags: Array<string>,
    createdAt: string,
    updatedAt: string,
    deletedAt: string | null
  }

  state {
    tasks: Array<Task> = []
    selectedTaskId: string | null = null
    viewMode: "kanban" | "todo" | "table" | "trash" = "kanban"
    assistantOpen: boolean = true
  }

  // --- Computed: filtering ---
  computed activeTasks = filter(tasks, isNull($item.deletedAt))
  computed deletedTasks = filter(tasks, isNotNull($item.deletedAt))

  // --- Computed: status groups (reference activeTasks) ---
  computed todoTasks = filter(activeTasks, eq($item.status, "todo"))
  computed inProgressTasks = filter(activeTasks, eq($item.status, "in-progress"))
  computed reviewTasks = filter(activeTasks, eq($item.status, "review"))
  computed doneTasks = filter(activeTasks, eq($item.status, "done"))

  // --- Computed: counts ---
  computed totalCount = len(activeTasks)
  computed todoCount = len(todoTasks)
  computed inProgressCount = len(inProgressTasks)
  computed reviewCount = len(reviewTasks)
  computed doneCount = len(doneTasks)
  computed deletedCount = len(deletedTasks)

  // --- Actions ---
  action createTask(task: Task) {
    onceIntent {
      patch tasks = append(tasks, task)
    }
  }

  action updateTask(id: string, title: string | null, description: string | null,
                    status: string | null, priority: string | null,
                    assignee: string | null, dueDate: string | null,
                    tags: Array<string> | null, updatedAt: string) {
    onceIntent {
      patch tasks = map(tasks,
        cond(eq($item.id, id),
          {
            id: $item.id,
            title: coalesce(title, $item.title),
            description: cond(isNotNull(description), description, $item.description),
            status: coalesce(status, $item.status),
            priority: coalesce(priority, $item.priority),
            assignee: cond(isNotNull(assignee), assignee, $item.assignee),
            dueDate: cond(isNotNull(dueDate), dueDate, $item.dueDate),
            tags: coalesce(tags, $item.tags),
            createdAt: $item.createdAt,
            updatedAt: updatedAt,
            deletedAt: $item.deletedAt
          },
          $item
        )
      )
    }
  }

  action moveTask(taskId: string, newStatus: "todo" | "in-progress" | "review" | "done") {
    onceIntent {
      patch tasks = map(tasks,
        cond(eq($item.id, taskId),
          {
            id: $item.id, title: $item.title, description: $item.description,
            status: newStatus, priority: $item.priority, assignee: $item.assignee,
            dueDate: $item.dueDate, tags: $item.tags, createdAt: $item.createdAt,
            updatedAt: $item.updatedAt, deletedAt: $item.deletedAt
          },
          $item
        )
      )
    }
  }

  action softDeleteTask(id: string, timestamp: string) {
    onceIntent {
      patch tasks = map(tasks,
        cond(eq($item.id, id),
          {
            id: $item.id, title: $item.title, description: $item.description,
            status: $item.status, priority: $item.priority, assignee: $item.assignee,
            dueDate: $item.dueDate, tags: $item.tags, createdAt: $item.createdAt,
            updatedAt: $item.updatedAt, deletedAt: timestamp
          },
          $item
        )
      )
    }
  }

  action restoreTask(id: string) {
    onceIntent {
      patch tasks = map(tasks,
        cond(eq($item.id, id),
          {
            id: $item.id, title: $item.title, description: $item.description,
            status: $item.status, priority: $item.priority, assignee: $item.assignee,
            dueDate: $item.dueDate, tags: $item.tags, createdAt: $item.createdAt,
            updatedAt: $item.updatedAt, deletedAt: null
          },
          $item
        )
      )
    }
  }

  action permanentlyDeleteTask(id: string) {
    onceIntent {
      patch tasks = filter(tasks, neq($item.id, id))
    }
  }

  action emptyTrash() {
    onceIntent {
      patch tasks = filter(tasks, isNull($item.deletedAt))
    }
  }

  action selectTask(taskId: string | null) {
    onceIntent {
      patch selectedTaskId = taskId
    }
  }

  action changeView(mode: "kanban" | "todo" | "table" | "trash") {
    onceIntent {
      patch viewMode = mode
    }
  }

  action toggleAssistant(open: boolean) {
    onceIntent {
      patch assistantOpen = open
    }
  }
}`;
