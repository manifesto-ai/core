import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";

interface FilterTabsProps {
  filter: "all" | "active" | "completed";
  onFilterChange: (filter: "all" | "active" | "completed") => void;
  counts: {
    all: number;
    active: number;
    completed: number;
  };
}

export function FilterTabs({ filter, onFilterChange, counts }: FilterTabsProps) {
  return (
    <Tabs value={filter} onValueChange={(v) => onFilterChange(v as typeof filter)}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="all" className="gap-2">
          All
          <Badge variant="secondary" className="h-5 px-1.5">
            {counts.all}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="active" className="gap-2">
          Active
          <Badge variant="secondary" className="h-5 px-1.5">
            {counts.active}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="completed" className="gap-2">
          Completed
          <Badge variant="secondary" className="h-5 px-1.5">
            {counts.completed}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
