import { type Channel, Presence } from 'phoenix';
import { useCallback, useEffect, useRef, useState } from 'react';
import { channelFor } from '@/lib/socket';
import type { MemberRole, Op } from '@/protocol/ops';
import { createRoomStore, type RoomStore } from '@/store/roomStore';

/**
 * Joins `room:<slug>` and mirrors the room into the room store.
 *
 * The store is created fresh for this room and returned for the provider:
 * inbound `new_op` echoes are sent to it strictly in `seq` order, the join
 * payload replays the op log, presence syncs the member list. Outbound
 * `sendOp` pushes an op to the server — it reaches the store only via the
 * server echo, so there is exactly one application path.
 *
 * An echo arriving with a `seq` gap means an op was lost or reordered in
 * transit (Phoenix PubSub only orders per publisher process). The client
 * resyncs by rejoining — replay is the one application path (ADR-0005), so a
 * fresh join replays the authoritative log.
 *
 * Event handlers ignore events from a channel that has been superseded by a
 * rejoin, so late arrivals from a previous connection cannot mutate the new
 * room's state.
 *
 * A channel factory can be injected for tests; it defaults to the real
 * Phoenix socket.
 */
export function useRoomChannel(
  slug: string,
  selfId: string | null = null,
  selfName: string | null = null,
  channelFactory: (topic: string, params?: Record<string, string>) => Channel = channelFor,
) {
  const channelRef = useRef<Channel | null>(null);
  const channelFactoryRef = useRef(channelFactory);
  channelFactoryRef.current = channelFactory;
  // The store is created during render (lazy, one per slug) so the provider
  // has it on the very first frame — creating it in the effect rendered one
  // null-store frame first and remounted the whole room (the "flicker").
  const storeRef = useRef<{ slug: string; store: RoomStore } | null>(null);
  if (storeRef.current === null || storeRef.current.slug !== slug) {
    storeRef.current = { slug, store: createRoomStore(slug) };
  }
  const store = storeRef.current.store;
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // Bump to force the effect below to leave and rejoin (the gap resync).
  const [rejoinNonce, setRejoinNonce] = useState(0);
  // A just-created room can take a moment to become visible cluster-wide
  // (the registry is eventually consistent across nodes), so a
  // room_not_found gets one retry before we believe it — tracked per slug.
  const notFoundRetriedFor = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rejoinNonce re-runs the effect (leave + rejoin) without being referenced inside
  useEffect(() => {
    const roomStore = store;
    const params: Record<string, string> = {};
    if (selfId !== null) {
      params.profile_id = selfId;
    }
    if (selfName !== null) {
      params.name = selfName;
    }
    const channel = channelFactoryRef.current(`room:${slug}`, params);
    channelRef.current = channel;
    let retryTimer: number | null = null;
    let lagTimer: number | null = null;

    // The highest seq known to be in the store (the join replay below sets
    // the baseline). Echoes must succeed it exactly; anything higher is a
    // gap, anything at or below is a stale duplicate.
    let lastSeq = 0;

    channel.on('new_op', (op: Op) => {
      if (channelRef.current !== channel) {
        return;
      }
      if (op.seq === lastSeq + 1) {
        lastSeq = op.seq;
        roomStore.send(op);
      } else if (op.seq > lastSeq + 1) {
        setRejoinNonce((n) => n + 1);
      }
    });
    channel.on('role_update', (update: { member_id: string; role: MemberRole }) => {
      if (channelRef.current === channel) {
        roomStore.send({ type: 'role.changed', ...update });
      }
    });
    channel.on('presenter_update', (update: { member_id: string | null }) => {
      if (channelRef.current === channel) {
        roomStore.send({ type: 'presenter.set', value: update.member_id });
      }
    });
    // Presence: the phoenix helper tracks metas per profile id (one member
    // can hold several tabs — a diff's "leave" of one tab is not the member
    // leaving), so the store syncs the authoritative list on every change
    // instead of applying joins/leaves itself.
    const presence = new Presence(channel);
    presence.onSync(() => {
      if (channelRef.current === channel) {
        const members = presence.list((id, meta: { metas: { name?: string }[] }) => ({
          id,
          name: meta.metas[0]?.name ?? 'Anonymous',
        }));
        roomStore.send({ type: 'members.synced', members });
      }
    });
    channel.on(
      'analysis_progress',
      (progress: { game_id: string; done: number; total: number }) => {
        if (channelRef.current === channel) {
          roomStore.send({
            type: 'analysisProgress.set',
            value: { gameId: progress.game_id, done: progress.done, total: progress.total },
          });
        }
      },
    );

    channel
      .join()
      .receive(
        'ok',
        (payload: {
          ops: Op[];
          roles?: Record<string, MemberRole>;
          presenter?: string | null;
          region?: string;
          room_region?: string | null;
          read_only?: boolean;
        }) => {
          if (channelRef.current === channel) {
            setJoinError(null);
            roomStore.send({ type: 'room.replayed', ops: payload.ops });
            roomStore.send({ type: 'roles.set', roles: payload.roles ?? {} });
            roomStore.send({ type: 'presenter.set', value: payload.presenter ?? null });
            roomStore.send({ type: 'region.set', value: payload.region ?? null });
            roomStore.send({ type: 'roomRegion.set', value: payload.room_region ?? null });
            roomStore.send({ type: 'readOnly.set', value: payload.read_only ?? false });
            lastSeq = payload.ops.reduce((max, op) => Math.max(max, op.seq), 0);
            setJoined(true);

            // The lag probe: a trivial round-trip every 10s while joined.
            const probe = () => {
              if (channelRef.current !== channel) {
                return;
              }
              const start = Date.now();
              channel.push('ping', {}).receive('ok', () => {
                if (channelRef.current === channel) {
                  roomStore.send({ type: 'lag.set', ms: Date.now() - start });
                }
              });
            };
            probe();
            lagTimer = window.setInterval(probe, 10_000);
          }
        },
      )
      .receive('error', (payload: { reason?: string }) => {
        if (channelRef.current !== channel) {
          return;
        }
        if (payload?.reason === 'room_not_found' && notFoundRetriedFor.current !== slug) {
          notFoundRetriedFor.current = slug;
          retryTimer = window.setTimeout(() => setRejoinNonce((n) => n + 1), 400);
          return;
        }
        setJoined(false);
        setJoinError(payload?.reason ?? 'unknown');
      })
      .receive('timeout', () => {
        if (channelRef.current === channel) {
          setJoined(false);
          setJoinError('timeout');
        }
      });

    return () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      if (lagTimer !== null) {
        window.clearInterval(lagTimer);
      }
      channel.leave();
      channelRef.current = null;
      roomStore.send({ type: 'room.left' });
      setJoined(false);
      setJoinError(null);
    };
  }, [slug, selfId, selfName, rejoinNonce]);

  const sendOp = useCallback((op: Omit<Op, 'seq' | 'author' | 'ts'>, onError?: () => void) => {
    const push = channelRef.current?.push('op', op);
    // Server rejections (op limit, lost edit rights) let the caller roll
    // back any optimistic state — a dropped echo must not leave a phantom.
    push?.receive('error', () => onError?.());
  }, []);

  const sendRole = useCallback((memberId: string, role: MemberRole) => {
    channelRef.current?.push('set_role', { member_id: memberId, role });
  }, []);

  /** Hands the presenter mic to a member (owner only). */
  const sendPresenter = useCallback((memberId: string) => {
    channelRef.current?.push('set_presenter', { member_id: memberId });
  }, []);

  /** Requests a whole-game engine analysis (ADR-0009); the result arrives as a set_analysis op. */
  const sendAnalyze = useCallback((gameId: string, positions: { ply: number; fen: string }[]) => {
    channelRef.current?.push('analyze_game', { game_id: gameId, positions });
  }, []);

  return { joined, joinError, store, sendOp, sendRole, sendPresenter, sendAnalyze };
}
