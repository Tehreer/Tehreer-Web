import type { ReactNode } from "react";

/** A select with a chevron that keeps its distance from the right edge. */
export function Select({ id, label, value, onChange, children }: {
  id?: string;
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="select">
      <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l5 5 5-5" />
      </svg>
    </div>
  );
}
