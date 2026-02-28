import { useState, useMemo } from 'react';
import { NIGERIAN_UNIVERSITIES } from '@/data/nigerianUniversities';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Search, X, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface UniversitySelectProps {
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}

export default function UniversitySelect({ value, onChange, className }: UniversitySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return NIGERIAN_UNIVERSITIES;
    const q = search.toLowerCase();
    return NIGERIAN_UNIVERSITIES.filter(u => u.toLowerCase().includes(q));
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between bg-secondary border-border text-left font-normal h-10 ${!value ? 'text-muted-foreground' : 'text-foreground'} ${className || ''}`}
        >
          <span className="truncate">{value || 'Select your university'}</span>
          {value ? (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            />
          ) : (
            <Search className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Search universities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 bg-secondary border-border"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[250px]">
          <div className="p-1">
            {search.trim() && !NIGERIAN_UNIVERSITIES.some(u => u.toLowerCase() === search.trim().toLowerCase()) && (
              <button
                onClick={() => {
                  onChange(search.trim());
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground text-left text-primary border-b border-border/50 mb-1"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Use "{search.trim()}"</span>
              </button>
            )}
            {filtered.length === 0 && !search.trim() ? (
              <p className="text-sm text-muted-foreground text-center py-4">Search for your university</p>
            ) : filtered.length === 0 && search.trim() ? (
              <p className="text-sm text-muted-foreground text-center py-4">No matching universities found</p>
            ) : (
              filtered.map((uni) => (
                <button
                  key={uni}
                  onClick={() => {
                    onChange(uni);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground text-left"
                >
                  <Check className={`h-4 w-4 shrink-0 ${value === uni ? 'opacity-100 text-primary' : 'opacity-0'}`} />
                  <span className="truncate">{uni}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
