import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface DropdownItem {
  value: string;
  label: string;
  badge?: string;
}

interface LocationDropdownProps {
  id: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  value: string;
  items: DropdownItem[];
  disabled?: boolean;
  hasError?: boolean;
  icon: React.ReactNode;
  onChange: (value: string) => void;
  onBlurValidate?: () => void;
}

export const LocationDropdown: React.FC<LocationDropdownProps> = ({
  id,
  label,
  placeholder,
  searchPlaceholder,
  value,
  items,
  disabled = false,
  hasError = false,
  icon,
  onChange,
  onBlurValidate,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.value === value) || null,
    [items, value]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onBlurValidate?.();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        onBlurValidate?.();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onBlurValidate]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${open ? 'z-40' : 'z-10'}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`group relative flex w-full items-center justify-between rounded-2xl border text-left transition-all duration-200 py-3.5 pl-4 pr-3.5 ${
          disabled
            ? 'border-[#E6D5BF]/70 bg-[#FAF3E8]/55 text-[#9D8370] cursor-not-allowed opacity-70'
            : hasError
              ? 'border-red-500 ring-2 ring-red-500/15 bg-red-50/30 cursor-pointer'
              : open
                ? 'border-[#B84A27] bg-white ring-4 ring-amber-500/10 cursor-pointer'
                : 'border-[#DFCBB3] bg-[#FCF8F2] hover:border-[#C88A2B] hover:bg-white cursor-pointer'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`shrink-0 transition-colors ${
              open ? 'text-[#B84A27]' : 'text-[#8C6E58] group-hover:text-[#B84A27]'
            }`}
          >
            {icon}
          </span>
          <span
            className={`truncate text-[14.5px] sm:text-[15px] ${
              selectedItem ? 'font-medium text-[#22150E]' : 'text-[#9D8370]'
            }`}
          >
            {selectedItem ? selectedItem.label : placeholder}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pl-2">
          {selectedItem?.badge && (
            <span className="rounded-md bg-[#FAF0E0] border border-[#DFC9AB] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#8C4A19]">
              {selectedItem.badge}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-[#8C6E58] transition-transform duration-200 ${
              open ? 'rotate-180 text-[#B84A27]' : ''
            }`}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.985 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-[#DFC9AB] bg-[#FFFDF9] shadow-[0_24px_48px_-12px_rgba(34,21,14,0.3)] ring-1 ring-black/5"
          >
            {/* Gold hairline top accent */}
            <div className="h-0.5 w-full bg-gradient-to-r from-[#B84A27] via-[#E5AE4E] to-[#4B644A]" />

            {/* Search input inside menu */}
            <div className="border-b border-[#EFE3D2] bg-[#FAF3E8]/55 px-3 py-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#DFCBB3] bg-white px-2.5 py-1.5 focus-within:border-[#C88A2B]">
                <Search className="h-3.5 w-3.5 shrink-0 text-[#9D8370]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-xs sm:text-[13px] text-[#22150E] placeholder:text-[#9D8370] focus:outline-none"
                />
              </div>
            </div>

            {/* Options list */}
            <ul
              role="listbox"
              aria-label={label}
              className="max-h-56 overflow-y-auto py-1.5 px-1.5 space-y-0.5"
            >
              {filteredItems.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-[#8C6E58]">
                  No se encontraron coincidencias.
                </li>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = item.value === value;
                  return (
                    <li key={item.value} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.value)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs sm:text-[13.5px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#FAF0E0] to-[#FFF8EC] font-semibold text-[#8C3318]'
                            : 'text-[#3D2A1E] hover:bg-[#FAF3E8]'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {item.badge && (
                            <span className="text-[10px] font-bold tracking-wider text-[#9D8370]">
                              {item.badge}
                            </span>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-[#C88A2B]" />}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
