import { CheckCircle2, Circle, ListTodo } from "lucide-react";

interface TodoStatsProps {
  total: number;
  active: number;
  completed: number;
}

export function TodoStats({ total, active, completed }: TodoStatsProps) {
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <ListTodo className="h-4 w-4" />
          <span>{total} total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="h-4 w-4" />
          <span>{active} active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          <span>{completed} done</span>
        </div>
      </div>
      <div className="font-medium">
        {completionRate}% complete
      </div>
    </div>
  );
}
