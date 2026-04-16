import { RotateCcw } from "lucide-react";

export const DEFAULT_FROM = "2026-04-14";
export const DEFAULT_TO = "2026-04-23";

interface DateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  onClear: () => void;
}

export function DateRangeFilter({ fromDate, toDate, onFromChange, onToChange, onClear }: DateRangeFilterProps) {
  const isDefault = fromDate === DEFAULT_FROM && toDate === DEFAULT_TO;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {!isDefault && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear filter
        </button>
      )}
    </div>
  );
}
