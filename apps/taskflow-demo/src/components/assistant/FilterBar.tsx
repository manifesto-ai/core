'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker, type DateFilter } from '@/components/ui/date-range-picker';

interface FilterBarProps {
  dateFilter: DateFilter | null;
  onDateFilterChange: (filter: DateFilter | null) => void;
  className?: string;
}

export function FilterBar({
  dateFilter,
  onDateFilterChange,
  className,
}: FilterBarProps) {
  const hasActiveFilters = dateFilter !== null;

  const handleClearAll = () => {
    onDateFilterChange(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={className}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filters:</span>

        <DateRangePicker
          value={dateFilter}
          onChange={onDateFilterChange}
          placeholder="Date"
        />

        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClearAll}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
