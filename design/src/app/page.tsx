import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { CreateJoin } from "@/components/HomeClient";
import { Wordmark } from "@/components/Brand";
import { getViewer } from "@/lib/server/identity";
import { ROLE_META } from "@/lib/identity";
import { button, chip, statusDot } from "@/ui/variants";

export const dynamic = "force-dynamic";

async function backendStatus() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
}

export default async function HomePage() {
  const viewer = await getViewer();
  const status = await backendStatus();

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Wordmark size="sm" href={null} />
        <nav className="ml-auto flex items-center gap-1">
          {/* Library is the future home of saved games + claimable rooms */}
          <Link href="/library" className={button({ intent: "ghost", size: "sm" })}>
            Library
          </Link>
          <Link href="/design" className={button({ intent: "ghost", size: "sm" })}>
            Design system
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col justify-center gap-8 px-5 py-10">
        <div>
          <div className="flex items-center gap-4">
            <Wordmark size="lg" href={null} />
          </div>
          <p className="mt-3 max-w-[54ch] text-lead text-muted">
            Analyse chess together in real time. One board, one variation tree,
            everyone&apos;s cursor — plus an engine that never stops second-guessing
            you.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 text-note text-faint">
            {[
              "Shared variation tree",
              "Per-move comments",
              "Presenter mode",
              "Engine eval",
              "PGN & Lichess import",
            ].map((feature) => (
              <li key={feature} className={chip({ tone: "outline" })}>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <CreateJoin />

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-center gap-2 text-note text-muted">
            <span className="text-faint">You are</span>
            <span className="rounded-control border border-line-strong bg-panel px-2 py-1 font-semibold text-ink">
              {viewer.name}
            </span>
            <span className={`text-[13px] ${ROLE_META.collaborator.tone}`} aria-hidden>
              {ROLE_META.collaborator.glyph}
            </span>
            <span className="text-faint">
              anonymous, remembered on this device
            </span>
          </p>
          <p
            className="flex items-center gap-2 text-note"
            aria-live="polite"
            title={status.ok ? "Database reachable" : "Database unreachable"}
          >
            <span className={statusDot({ tone: status.ok ? "ok" : "bad", pulse: !status.ok })} />
            <span className={status.ok ? "text-muted" : "text-bad-hi"}>
              backend {status.ok ? "ready" : "unreachable"}
            </span>
            <span className="tnum text-faint">{status.ms}ms</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
