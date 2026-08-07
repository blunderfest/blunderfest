"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CODE_ALPHABET, isValidCode, normalizeCode } from "@/lib/identity";
import { button, helpText, fieldLabel, input } from "@/ui/variants";

export function CreateJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const dirty = code.length > 0;
  const invalid = dirty && !isValidCode(code) && code.length === 5;

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      router.push(`/room/${data.code}`);
    } catch {
      setCreating(false);
      setError("Could not create a room — the backend did not answer.");
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidCode(code)) {
      setError("Codes are exactly 5 characters from the unambiguous alphabet.");
      return;
    }
    setJoining(true);
    router.push(`/room/${normalizeCode(code)}`);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
      <div className="rounded-panel border border-line bg-panel p-4">
        <h2 className="text-lead font-bold">Start a study</h2>
        <p className="mt-1 text-note text-muted">
          Creates a room, makes you the owner, and hands you a 5-character code
          to share.
        </p>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className={button({ intent: "primary", size: "lg", block: true }) + " mt-4"}
        >
          {creating ? "Creating room…" : "Create a room"}
        </button>
        <p className={helpText()}>
          <span aria-hidden>⌘</span>
          <span>No account needed. The room stays open as long as it is used.</span>
        </p>
      </div>

      <div
        aria-hidden
        className="hidden select-none flex-col items-center gap-2 self-stretch pt-8 text-micro uppercase tracking-[0.18em] text-faint sm:flex"
      >
        <span className="w-px flex-1 bg-line" />
        or
        <span className="w-px flex-1 bg-line" />
      </div>

      <form onSubmit={join} className="rounded-panel border border-line bg-panel p-4" noValidate>
        <h2 className="text-lead font-bold">Join with a code</h2>
        <p className="mt-1 text-note text-muted">
          Someone shared five characters with you? Drop them in.
        </p>
        <div className="mt-4">
          <label htmlFor="room-code" className={fieldLabel()}>
            Room code
          </label>
          <input
            id="room-code"
            name="code"
            value={code}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            maxLength={5}
            aria-invalid={invalid}
            aria-describedby="code-help"
            placeholder="e.g. qh4nx"
            onChange={(event) => {
              setCode(normalizeCode(event.target.value));
              setError(null);
            }}
            className={input({ size: "lg", mono: true, invalid: invalid || Boolean(error) })}
          />
          <p
            id="code-help"
            className={helpText({ tone: invalid || error ? "bad" : "muted" })}
          >
            {invalid || error ? (
              <>
                <span aria-hidden>⚠</span>
                <span>{error ?? `Only ${CODE_ALPHABET.length} allowed characters — no i, l, o, 0 or 1.`}</span>
              </>
            ) : (
              <span className="tnum">{code.length}/5 characters</span>
            )}
          </p>
        </div>
        <button
          type="submit"
          disabled={!isValidCode(code) || joining}
          className={button({ intent: "secondary", size: "lg", block: true }) + " mt-3"}
        >
          {joining ? "Joining…" : "Join room"}
        </button>
      </form>
    </div>
  );
}
