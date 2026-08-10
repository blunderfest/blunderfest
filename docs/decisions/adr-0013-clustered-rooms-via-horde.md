# ADR-0013: Cluster the Fly machines; rooms reachable from every region via Horde

Status: Accepted (2026-08-10)

## Context

`fly.toml` runs one machine in `ams` and one in `ord`. With everything
in-memory (ADR-0001) and no clustering, a room existed only in the memory of
the machine that created it: Fly routes each user to the nearest running
machine, so whenever both machines were awake (load, failover, rolling
deploys) users in different regions could not see the same room — or worse,
could create the same code twice and diverge. It "worked" only because
auto-stop usually left a single machine awake.

ADR-0012 made each room its own process behind a node-local Registry — a
single-node answer. To make rooms reachable from every region we considered:

- **Horde** (distributed Registry + DynamicSupervisor over Erlang
  distribution and CRDTs). Rooms live on one node but are discoverable and
  callable from all nodes; Phoenix PubSub and Presence already replicate
  once nodes connect.
- **`fly-replay` pinning**: hash the room code to a home machine, replay
  misplaced requests there. Simpler (no distribution) but every WebSocket
  message from the far region pays the transatlantic RTT, and it needs
  machine-discovery plumbing Horde already gives us.

## Decision

Cluster the machines and swap the room registry/supervisor for Horde:

- `rel/env.sh.eex` names each node `<app>@<private-ip>`; `DNS_CLUSTER_QUERY`
  in `fly.toml` lets the existing DNSCluster child connect them;
  `RELEASE_COOKIE` was already in `fly secrets`.
- `Blunderfest.RoomRegistry` → `Horde.Registry`, `Blunderfest.RoomSupervisor`
  → `Horde.DynamicSupervisor`, both with `members: :auto` (membership follows
  the cluster). The `Rooms` facade and its test scopes are unchanged apart
  from the module swap.
- A far-region join/append pays cross-region `GenServer.call` latency
  (~85 ms per round trip): joins do up to three calls, an op does two.
  Acceptable for a review tool.

## Consequences

- Users in Amsterdam and the US see the same rooms, presence, and op stream.
- **Netsplit window**: during an AMS↔ORD partition, the same room code can be
  started on both nodes; on heal, Horde's CRDT keeps one registration and the
  other process is stopped, discarding its ops. Rooms are ephemeral, so this
  is annoying, not corrupting.
- Room state is still lost on crashes, stops, and deploys — unchanged from
  ADR-0001 semantics. If durability ever matters, that's the database
  conversation, not a Horde knob.
- Supersedes the node-local Registry/DynamicSupervisor half of ADR-0012; the
  per-room process model stands.
