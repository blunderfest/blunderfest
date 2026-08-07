import Link from "next/link";

/**
 * Wordmark: a gold knight tile (the mascot — a knight mid-blunder, "?!" badge)
 * plus "Blunder" in ink and "fest" in gold. The tile alone is the app icon.
 */
export function Mark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: "h-6 w-6 text-[15px] rounded-[6px]",
    md: "h-8 w-8 text-[19px] rounded-[8px]",
    lg: "h-12 w-12 text-[28px] rounded-[11px]",
  }[size];
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center bg-gradient-to-b from-gold-hi to-gold-dim leading-none text-[#1b1608] shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_2px_8px_-2px_rgba(201,162,39,0.5)] ${dims}`}
    >
      <span className="-mt-px">&#9822;</span>
      <span className="absolute -right-1 -top-1 rounded-full bg-bad px-1 text-[8px] font-bold leading-[13px] text-white shadow-[0_0_0_2px_var(--color-surface)]">
        ?!
      </span>
    </span>
  );
}

export function Wordmark({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const text = {
    sm: "text-ui",
    md: "text-lead",
    lg: "text-hero",
  }[size];
  const content = (
    <span className="flex items-center gap-2.5">
      <Mark size={size} />
      <span className={`font-bold tracking-tight ${text}`}>
        Blunder<span className="text-gold-hi">fest</span>
      </span>
    </span>
  );
  if (!href) return content;
  return (
    <Link
      href={href}
      className="rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-hi"
    >
      {content}
    </Link>
  );
}
