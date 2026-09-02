'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SORT_FIELDS, SORT_LABELS, type SortField } from '@/lib/contacts/query';
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@/lib/contacts/schema';

export type FilterState = {
  search: string;
  priority: string;
  sort: SortField;
  direction: 'asc' | 'desc';
};

export function ContactFilters({
  value,
  onChange,
  disabled,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    onChange({ ...value, [key]: v });

  const hasFilters = value.search !== '' || value.priority !== 'all';

  return (
    <div className="border-border/70 bg-card animate-rise rounded-2xl border p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="search" className="text-muted-foreground text-xs font-medium">
            Search
          </Label>
          <div className="group relative">
            <Search
              className="text-muted-foreground group-focus-within:text-brand pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 transition-colors"
              aria-hidden
            />
            <Input
              id="search"
              type="search"
              placeholder="Name, company, role or where you met"
              className="pl-9 transition-shadow"
              value={value.search}
              disabled={disabled}
              onChange={(e) => set('search', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="priority-filter"
            className="text-muted-foreground text-xs font-medium"
          >
            Priority
          </Label>
          <Select
            value={value.priority}
            disabled={disabled}
            onValueChange={(v) => set('priority', v ?? 'all')}
          >
            <SelectTrigger id="priority-filter" className="w-full">
              {/* Base UI renders the raw value by default, so map it to a label. */}
              <SelectValue>
                {(v) =>
                  v == null || v === 'all'
                    ? 'All priorities'
                    : PRIORITY_LABELS[v as Priority]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="sort-field"
            className="text-muted-foreground text-xs font-medium"
          >
            Sort by
          </Label>
          <div className="flex gap-2">
            <Select
              value={value.sort}
              disabled={disabled}
              onValueChange={(v) => v && set('sort', v as SortField)}
            >
              <SelectTrigger id="sort-field" className="w-full">
                <SelectValue>
                  {(v) => (v == null ? 'Sort by' : SORT_LABELS[v as SortField])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {SORT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={disabled}
              aria-label={
                value.direction === 'asc'
                  ? 'Sorted ascending. Switch to descending.'
                  : 'Sorted descending. Switch to ascending.'
              }
              title={value.direction === 'asc' ? 'Ascending' : 'Descending'}
              onClick={() =>
                set('direction', value.direction === 'asc' ? 'desc' : 'asc')
              }
            >
              <SlidersHorizontal
                className={`size-4 transition-transform duration-300 ${
                  value.direction === 'asc' ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="border-border/60 animate-fade-in mt-3 flex items-center gap-2 border-t pt-3">
          <span className="text-muted-foreground text-xs">Filters active</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
            onClick={() => onChange({ ...value, search: '', priority: 'all' })}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
