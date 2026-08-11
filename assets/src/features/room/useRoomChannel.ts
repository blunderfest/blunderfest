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

    dispatch(enterRoom({ slug }));

    channel.on('new_op', (op: Op) => {
      if (channelRef.current === channel) {
        dispatch(applyOp(op));
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
            setJoined(true);
          }
        },
      )
      .receive('error', (payload: { reason?: string }) => {
        if (channelRef.current === channel) {
          setJoined(false);
          setJoinError(payload?.reason ?? 'unknown');
          dispatch(leaveRoom());
        }
      })
      .receive('timeout', () => {
        if (channelRef.current === channel) {
          setJoined(false);
          setJoinError('timeout');
          dispatch(leaveRoom());
        }
      });

    return () => {
      channel.leave();
      channelRef.current = null;
      dispatch(leaveRoom());
      setJoined(false);
      setJoinError(null);
    };
  }, [dispatch, slug, selfId, selfName]);

  const sendOp = useCallback((op: Omit<Op, 'seq' | 'author' | 'ts'>) => {
    channelRef.current?.push('op', op);
  }, []);

  const sendRole = useCallback((memberId: string, role: MemberRole) => {
    channelRef.current?.push('set_role', { member_id: memberId, role });
  }, []);

  return { joined, joinError, sendOp, sendRole };
}
