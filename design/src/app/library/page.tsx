import Link from "next/link";
import { Wordmark } from "@/components/Brand";
import { button, chip, panelTitle } from "@/ui/variants";

export const metadata = { title: "Library — Blunderfest" };

const PLANNED = [
  {
    title: "Saved games",
    body: "Everything you imported, across rooms. Rows reuse the game-list row spec (players, event, ply/node counts, result chip).",
  },
  {
    title: "Claimable rooms",
    body: "Anonymous rooms you own on this device. Signing in later claims them — the header slot on the right is reserved for the account menu.",
  },
  {
    title: "Position search",
    body: "Exact and similar positions across the corpus, with configurable weights (shift / substitute / add / remove / colour flip) and decomposed result labels.",
  },
  {
    title: "Master reference",
    body: "What was played here historically — docks as a sidebar panel in the room, and as a full table here.",
  },
];

export default function LibraryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-void">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Wordmark size="sm" />
        <span className="ml-auto flex gap-1">
          <Link href="/" className={button({ intent: "ghost", size: "sm" })}>
            Home
          </Link>
          <Link href="/design" className={button({ intent: "ghost", size: "sm" })}>
            Design system
          </Link>
        </span>
      </header>
      <main className="mx-auto w-full max-w-[880px] px-5 py-10">
        <p className={panelTitle()}>Library</p>
        <h1 className="mt-1 text-display font-bold">Your games live here</h1>
        <p className="mt-2 max-w-[60ch] text-body text-muted">
          The library is the second top-level destination after a room. It is
          reachable from the header everywhere, so the room layout never has to
          grow a navigation area of its own.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {PLANNED.map((item) => (
            <li key={item.title} className="rounded-panel border border-line bg-panel p-4">
              <span className={chip({ tone: "gold" })}>planned</span>
              <h2 className="mt-2 text-body font-bold text-ink">{item.title}</h2>
              <p className="mt-1 text-note leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
