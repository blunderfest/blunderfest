import type { Channel } from 'phoenix';
import { useCallback, useEffect, useRef, useState } from 'react';
import { channelFor } from '@/lib/socket';
import type { MemberRole, Op, PresenceMember } from '@/protocol/ops';
import { useAppDispatch } from '@/store';
import {
  applyOp,
  enterRoom,
  joinMember,
  leaveMember,
  leaveRoom,
  replayOps,
  setMemberRole,
  setReadOnly,
  setRegion,
  setRoles,
} from '@/store/room';

type PresenceState = Record<string, { metas: { name?: string }[] }>;
type PresenceDiff = { joins: PresenceState; leaves: PresenceState };

function membersFrom(state: PresenceState): PresenceMember[] {
  return Object.entries(state).map(([id, presence]) => ({
    id,
    name: presence.metas[0]?.name ?? 'Anonymous',
  }));
}

/**
 * Joins `room:<slug>` and mirrors the room into the Redux store.
 *
 * Inbound: `new_op` echoes are applied strictly in `seq` order; the join
 * payload replays the op log; presence diffs update the member list.
 * Outbound: `sendOp` pushes an op to the server — it is applied on the
 * client only via the server echo, so there is exactly one application path.
 *
 * An echo arriving with a `seq` gap means an op was lost or reordered in
 * transit (Phoenix PubSub only orders per publisher process). The client
 * resyncs by rejoining — replay is the one application path (ADR-0005), so
 * a fresh join replays the authoritative log.
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
  const dispatch = useAppDispatch();
  const channelRef = useRef<Channel | null>(null);
  const channelFactoryRef = useRef(channelFactory);
  channelFactoryRef.current = channelFactory;
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

    dispatch(enterRoom({ slug }));

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
        dispatch(applyOp(op));
      } else if (op.seq > lastSeq + 1) {
        setRejoinNonce((n) => n + 1);
      }
    });
    channel.on('role_update', (update: { member_id: string; role: MemberRole }) => {
      if (channelRef.current === channel) {
        dispatch(setMemberRole(update));
      }
    });
    channel.on('presence_state', (state: PresenceState) => {
      if (channelRef.current === channel) {
        membersFrom(state).forEach((member) => {
          dispatch(joinMember(member));
        });
      }
    });
    channel.on('presence_diff', (diff: PresenceDiff) => {
      if (channelRef.current === channel) {
        membersFrom(diff.joins).forEach((member) => {
          dispatch(joinMember(member));
        });
        Object.keys(diff.leaves).forEach((id) => {
          dispatch(leaveMember({ id }));
        });
      }
    });

    channel
      .join()
      .receive(
        'ok',
        (payload: {
          ops: Op[];
          roles?: Record<string, MemberRole>;
          region?: string;
          read_only?: boolean;
        }) => {
          if (channelRef.current === channel) {
            setJoinError(null);
            dispatch(replayOps(payload.ops));
            dispatch(setRoles(payload.roles ?? {}));
            dispatch(setRegion(payload.region ?? null));
            dispatch(setReadOnly(payload.read_only ?? false));
            lastSeq = payload.ops.reduce((max, op) => Math.max(max, op.seq), 0);
            setJoined(true);
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
        dispatch(leaveRoom());
      })
      .receive('timeout', () => {
        if (channelRef.current === channel) {
          setJoined(false);
          setJoinError('timeout');
          dispatch(leaveRoom());
        }
      });

    return () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      channel.leave();
      channelRef.current = null;
      dispatch(leaveRoom());
      setJoined(false);
      setJoinError(null);
    };
  }, [dispatch, slug, selfId, selfName, rejoinNonce]);

  const sendOp = useCallback((op: Omit<Op, 'seq' | 'author' | 'ts'>, onError?: () => void) => {
    const push = channelRef.current?.push('op', op);
    // Server rejections (op limit, lost edit rights) let the caller roll
    // back any optimistic state — a dropped echo must not leave a phantom.
    push?.receive('error', () => onError?.());
  }, []);

  const sendRole = useCallback((memberId: string, role: MemberRole) => {
    channelRef.current?.push('set_role', { member_id: memberId, role });
  }, []);

  return { joined, joinError, sendOp, sendRole };
}
