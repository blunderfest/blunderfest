import Link from "next/link";
import { RoomClient } from "@/components/RoomClient";
import { Wordmark } from "@/components/Brand";
import { getViewer } from "@/lib/server/identity";
import { getRoomState } from "@/lib/server/rooms";
import { normalizeCode } from "@/lib/identity";
import { button, panelTitle } from "@/ui/variants";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const viewer = await getViewer();
  const clean = normalizeCode(code);
  const state = clean.length === 5 ? await getRoomState(clean, viewer, { join: true }) : null;

  if (!state) return <RoomNotFound code={code} />;
  return <RoomClient initial={state} />;
}

function RoomNotFound({ code }: { code: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-void p-6">
      <div className="w-full max-w-[420px] rounded-panel border border-line bg-panel p-6 text-center">
        <div className="mb-5 flex justify-center">
          <Wordmark size="md" />
        </div>
        <p className={panelTitle()}>Room not found</p>
        <p className="mt-2 text-body text-muted">
          No room answers to{" "}
          <code className="rounded-chip bg-raised px-1.5 py-0.5 font-mono text-ui tracking-[0.2em] text-bad-hi">
            {code.slice(0, 12)}
          </code>
          . Codes are 5 characters and never contain <b>i</b>, <b>l</b>, <b>o</b>,{" "}
          <b>0</b> or <b>1</b> — it may have been mistyped, or the room expired.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className={button({ intent: "primary", size: "md" })}>
            Back to home
          </Link>
          <Link href="/design" className={button({ intent: "ghost", size: "md" })}>
            Design system
          </Link>
        </div>
      </div>
    </main>
  );
}
