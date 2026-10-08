import * as React from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  /** Called with the text once typing pauses. */
  onSearch: (query: string) => void;
  placeholder?: string;
  /** Text to start with (e.g. a search kept in the page's state). */
  defaultValue?: string;
  className?: string;
  /** Pause before searching, in ms. */
  debounceMs?: number;
}

/** A search field that waits for a pause in typing before searching. */
export function SearchInput({ onSearch, placeholder, defaultValue = '', className, debounceMs = 350 }: SearchInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(defaultValue);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = placeholder ?? t('common.search');

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The page cleared its search (e.g. "Reset filters"): show it.
  React.useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  function change(next: string, immediate = false) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) onSearch(next);
    else timer.current = setTimeout(() => onSearch(next), debounceMs);
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => change(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="w-full bg-card border border-border rounded-md ps-9 pe-9 py-2 text-body text-foreground placeholder:text-text-disabled focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => change('', true)}
          aria-label={t('common.clearSearch')}
          className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-secondary hover:text-text-heading hover:bg-hover"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
