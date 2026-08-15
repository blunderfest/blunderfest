/** The on/off switch used by the settings rows and the engine box header. */
export default function Switch({
  on,
  onToggle,
  label,
  testid,
  disabled = false,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  testid: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testid}
      disabled={disabled}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? 'bg-gold' : 'border border-line-strong bg-raised'
      } ${disabled ? 'cursor-not-allowed' : ''}`}
      onClick={onToggle}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
