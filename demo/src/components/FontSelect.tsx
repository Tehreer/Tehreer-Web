import type { FontOption } from "../lib/fonts";
import { Select } from "./Select";

export function FontSelect({ id, label, options, value, onChange, className = "" }: {
  id: string;
  label: string;
  options: readonly FontOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <Select id={id} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </Select>
    </div>
  );
}
