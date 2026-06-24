import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Theme-matched dropdown that fully replaces the native <select>. The popover
 * list is rendered with app surfaces/colors so it looks consistent across
 * browsers and OSes (native option lists can't be styled).
 */
export function Select({ value, onChange, options, placeholder = "Select…", disabled, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ left: r.left, top: r.bottom + 4, width: r.width });
    }
    setOpen((o) => !o);
  }

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`w-full bg-surface border rounded text-body-sm py-1.5 pl-2.5 pr-2 flex items-center justify-between gap-2 transition-colors text-left ${
          disabled ? "opacity-50 cursor-not-allowed border-outline-variant" : "border-outline-variant hover:border-outline cursor-pointer"
        } ${open ? "border-primary ring-1 ring-primary" : ""}`}
      >
        <span className={`truncate ${selected ? "text-on-surface" : "text-on-surface-variant"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="expand_more" size={18} className={`text-on-surface-variant shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && coords && createPortal(
        <div
          // Rendered into <body> so position:fixed is viewport-relative even when
          // an ancestor (e.g. a modal with backdrop-filter) forms a containing block.
          className="fixed z-[200] glass-panel rounded-lg py-1 max-h-64 overflow-y-auto shadow-2xl"
          style={{ left: coords.left, top: coords.top, width: coords.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.length === 0 && <div className="px-3 py-2 text-body-sm text-on-surface-variant">No options</div>}
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                  active ? "bg-secondary-container/40 text-primary" : "text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="flex flex-col">
                  <span className="text-body-sm">{o.label}</span>
                  {o.hint && <span className="text-[11px] text-on-surface-variant">{o.hint}</span>}
                </span>
                {active && <Icon name="check" size={16} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
