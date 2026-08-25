# Historical Evidence API

The vertical slice's application-facing contract (design brief
`docs/implementation-vertical-slice-historical-evidence.md` §14, §17). The
backend exposes structured facts; the client owns the presentation. There
is **no relevance score** — never has been, never will be (§16).

## Endpoint

```
POST /api/historical-evidence
Content-Type: application/json
```

Request body:

```json
{
  "fen": "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 17",
  "route": ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5", "O-O", "Nc6", "d5", "Ne7"],
  "ref_ply": 16
}
```

* `fen` — required. Any legal FEN; the counters are not part of the
  position identity.
* `route` — optional SAN list leading to the position in the user's game
  (the moves up to and including `ref_ply`). Enables route comparison.
* `ref_ply` — optional; defaults to the route length.

Errors: `422 {"errors": {"code": "invalid_fen", "detail": ...}}` (ADR-0003).

## Response

```jsonc
{
  "reference": {
    "fen": "…",
    "occurrences": 28,           // exact occurrences of the position
    "games": 19,                 // independent games
    "families": [                // the decision menu (continuation families)
      { "id": 1, "occurrences": 13, "games": 11, "singleton": false,
        "members": [ { "moves": ["Ne1", "Ne8", "Nd3", "f5"], "occurrences": 8 } ] }
    ]
  },
  "candidates": [
    {
      "id": "pawn_skeleton-87136-17",
      "strategy": "exact" | "pawn_skeleton",
      "stm": "w" | "b",
      "fen": "…",
      "gid": 87136, "ply": 17,
      "game": { "gid": 87136, "white": "…", "black": "…", "result": "…",
                "date": "…", "eco": "…", "opening": "…", "white_elo": 2200,
                "black_elo": null, "event": "…", "time_control": "…", "site": "…" },
      "position": {
        "dims": {                    // the §8 comparison report
          "pawn_structure": "same" | ["different", 3],
          "material": "same" | ["different", "wP+1 bN-1"],
          "piece_placement": { "matches": 13, "mismatches": 2, "ref_pieces": 14 },
          "king_position": "same" | ["different", 2],
          "side_to_move": "same" | "differs",
          "castling": "same" | ["differs", "KQkq", "-"]
        },
        "differences": [ { "type": "tempo_twin", "detail": "…" } ]
      },
      "route": {
        "shared_plies": 6, "ref_ply": 16, "diverged_ply": 7,
        "ref_move": "e4", "cand_move": "e3", "ply_gap": 1,
        "extra_white": ["e3"], "extra_black": [],
        "missing_white": [], "missing_black": []
      },
      "continuation": {
        "moves": ["Ne8", "Bg5", "h6", "Be3", "f5", "Qc1"],
        "differences": [ { "type": "plan_divergence", "detail": "…" } ]
      },
      "families": {
        "membership": { "status": "member" | "none" | "no_menu", "member_of": 1,
                        "sim": 0.2, "family_occurrences": 13, "family_games": 11 },
        "skeleton": {
          "white": { "status": "none", "family_id": 1, "sim": 0.0,
                     "family_occurrences": 13, "family_games": 11 },
          "black": { "status": "member", "family_id": 1, "sim": 0.5,
                     "family_occurrences": 13, "family_games": 11 }
        }
      },
      "historical": { "occurrences": 1, "games": 1, "same_game_only": false },
      "flags": ["tempo_twin"]
    }
  ],
  "timings": { "candidates_ms": 33, "menu_ms": 5, "evidence_ms": 116, "total_ms": 162 }
}
```

## Semantics

* **Typed differences** (`tempo_twin`, `near_twin`, `piece_setup`,
  `king_position`, `material`, `structure`; continuation:
  `same_plan`, `timing_shift`, `plan_divergence`) are Spike 04's
  difference types — one entry per observable dimension, no fusion.
* **`route`** is Spike 05's mechanical route comparison: shared plies,
  the first diverging move per side, and the multiset extra/missing
  attribution. `ply_gap` = candidate ply − reference ply.
* **Families** are single-linkage clusters over the exact occurrences'
  continuations at the slice-wide setting (window 6, multiset Jaccard,
  threshold 0.5; Spike 04's validated settings). `singleton` marks a
  one-game family — not historical evidence of a recurring pattern.
* **Skeleton membership** (Spike 06) is the per-side annotation layer on
  top of those families: each color joins a family when its action-set
  similarity reaches 0.5. A tempo twin reads as "black executes the plan
  (joined), white reacts (did not)".
* **`same_game_only`** (brief §13): every occurrence comes from one game —
  the candidate is the same game repeated, not an independent example.
* **`flags`** is the union of the typed differences and the derived
  flags (`same_game_only`, `singleton`, `singleton_family`) — material for
  the UI, never a ranking.

## Known limitations (vertical slice)

* Structural candidates are capped (40 candidates, 2000 bucket keys, 8
  occurrences per key) — the caps are visible in the candidate list, not
  hidden in a score.
* No relaxed retrieval beyond the pawn-skeleton bucket (research showed
  ~1M candidates for uncontrolled relaxation).
* Per-candidate data is fetched with sequential queries through the
  facade; measured end-to-end on the 100k corpus: 170–354 ms per request
  (start position / KID tabiya / Ruy López tabiya). The packed binary
  index (ADR-0026's successor store) will replace this path if the corpus
  grows.
* The reference continuation window needs `route` + `ref_ply`; a bare FEN
  gets candidate-side windows only.
* Family clustering uses one general setting; per-reference tuning
  (Spike 04 had F1@multiset, A2@LCS) is deferred.
