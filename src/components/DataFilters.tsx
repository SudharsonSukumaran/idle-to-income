import { RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const DEFAULT_FROM = "2026-04-14";
export const DEFAULT_TO = "2026-04-23";

export type AssetGroup = "all" | "rooms" | "spa" | "tables" | "tour";
export type CategoryType = "all" | "spa_slot" | "table" | "tour_seat";
export type RoomTypeFilter = "all" | "Deluxe" | "Standard" | "Suite" | "2X" | "3X";
export type OccupancyFilter = "all" | "1" | "2" | "3+";

const ASSET_GROUP_LABELS: Record<AssetGroup, string> = {
  all: "All Groups",
  rooms: "Rooms",
  spa: "Spa Slots",
  tables: "Tables",
  tour: "Tour Buses",
};

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  all: "All Add-ons",
  spa_slot: "spa_slot",
  table: "table",
  tour_seat: "tour_seat",
};

/** Add-ons available per Asset Group. "rooms" group exposes room sub-types via the Room filter, so no add-on options here. */
const ADDONS_BY_GROUP: Record<AssetGroup, CategoryType[]> = {
  all: ["all", "spa_slot", "table", "tour_seat"],
  rooms: ["all"],
  spa: ["all", "spa_slot"],
  tables: ["all", "table"],
  tour: ["all", "tour_seat"],
};

const ROOM_TYPE_LABELS: Record<RoomTypeFilter, string> = {
  all: "All Rooms", Deluxe: "Deluxe", Standard: "Standard",
  Suite: "Suite", "2X": "2X", "3X": "3X",
};
const OCCUPANCY_LABELS: Record<OccupancyFilter, string> = {
  all: "Any Occupancy", "1": "1 guest", "2": "2 guests", "3+": "3+ guests",
};

/** Prefix-based filter for Asset Group dropdown */
export const ASSET_GROUP_PREFIXES: Record<Exclude<AssetGroup, "all">, string> = {
  rooms: "room",
  spa: "spa",
  tables: "table",
  tour: "tour",
};

export interface FilterState {
  fromDate: string;
  toDate: string;
  assetGroup: AssetGroup;
  categoryType: CategoryType;
  roomType: RoomTypeFilter;
  occupancy: OccupancyFilter;
}

interface DataFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function getDefaultFilters(): FilterState {
  return {
    fromDate: DEFAULT_FROM,
    toDate: DEFAULT_TO,
    assetGroup: "all",
    categoryType: "all",
    roomType: "all",
    occupancy: "all",
  };
}

export function DataFilters({ filters, onFiltersChange }: DataFiltersProps) {
  const isDefault =
    filters.fromDate === DEFAULT_FROM &&
    filters.toDate === DEFAULT_TO &&
    filters.assetGroup === "all" &&
    filters.categoryType === "all" &&
    filters.roomType === "all" &&
    filters.occupancy === "all";

  const update = (partial: Partial<FilterState>) =>
    onFiltersChange({ ...filters, ...partial });

  // When group changes, reset add-on type if it's not allowed for that group.
  const allowedTypes = ADDONS_BY_GROUP[filters.assetGroup];
  const handleGroupChange = (val: AssetGroup) => {
    const nextTypes = ADDONS_BY_GROUP[val];
    const nextCategory: CategoryType = nextTypes.includes(filters.categoryType)
      ? filters.categoryType
      : "all";
    onFiltersChange({ ...filters, assetGroup: val, categoryType: nextCategory });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date pickers */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => update({ fromDate: e.target.value })}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => update({ toDate: e.target.value })}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Asset Group */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Group</label>
          <Select
            value={filters.assetGroup}
            onValueChange={(val) => handleGroupChange(val as AssetGroup)}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ASSET_GROUP_LABELS) as [AssetGroup, string][]).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category Type */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Add-ons</label>
          <Select
            value={filters.categoryType}
            onValueChange={(val) => update({ categoryType: val as CategoryType })}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((val) => (
                <SelectItem key={val} value={val}>
                  {CATEGORY_TYPE_LABELS[val]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Room Type */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Room</label>
          <Select
            value={filters.roomType}
            onValueChange={(val) => update({ roomType: val as RoomTypeFilter })}
          >
            <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(ROOM_TYPE_LABELS) as [RoomTypeFilter, string][]).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Occupancy */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Occupancy</label>
          <Select
            value={filters.occupancy}
            onValueChange={(val) => update({ occupancy: val as OccupancyFilter })}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(OCCUPANCY_LABELS) as [OccupancyFilter, string][]).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isDefault && (
          <button
            onClick={() => onFiltersChange(getDefaultFilters())}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Filter summary bar */}
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Showing: <span className="font-medium text-foreground">{filters.fromDate}</span> → <span className="font-medium text-foreground">{filters.toDate}</span>
        {" | "}Group: <span className="font-medium text-foreground">{ASSET_GROUP_LABELS[filters.assetGroup]}</span>
        {" | "}Add-ons: <span className="font-medium text-foreground">{CATEGORY_TYPE_LABELS[filters.categoryType]}</span>
      </div>
    </div>
  );
}

/**
 * Given fetched units and slots, apply asset group & category filters client-side.
 * Returns filtered unit IDs set.
 */
export function applyUnitFilters(
  unitIds: string[],
  units: { id: string; category?: string | null }[],
  assetGroup: AssetGroup,
  categoryType: CategoryType,
): Set<string> {
  let filtered = new Set(unitIds);

  // Asset group prefix filter
  if (assetGroup !== "all") {
    const prefix = ASSET_GROUP_PREFIXES[assetGroup];
    filtered = new Set([...filtered].filter((id) => id.startsWith(prefix)));
  }

  // Category type filter
  if (categoryType !== "all") {
    const unitsByCategory = new Set(
      units.filter((u) => u.category === categoryType).map((u) => u.id),
    );
    filtered = new Set([...filtered].filter((id) => unitsByCategory.has(id)));
  }

  return filtered;
}
