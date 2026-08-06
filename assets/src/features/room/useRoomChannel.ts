import type { Channel } from 'phoenix';
import { useCallback, useEffect, useRef, useState } from 'react';
import { channelFor } from '@/lib/socket';
import type { MemberRole, Op } from '@/protocol/ops';
import { useAppDispatch } from '@/store';
import {
  applyOp,
  enterRoom,
  joinMember,
  leaveMember,
  leaveRoom,
  replayOps,
  setMemberRole,
  setRoles,
} from '@/store/room';

export type RoomPresenceMember = {
  id: string;
  name: string;
};

type PresenceState = Record<string, { metas: { name?: string }[] }>;
type PresenceDiff = { joins: PresenceState; leaves: PresenceState };

function membersFrom(state: PresenceState): RoomPresenceMember[] {
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
  const [presence, setPresence] = useState<RoomPresenceMember[]>([]);

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
      dispatch(applyOp(op));
    });
    channel.on('role_update', (update: { member_id: string; role: MemberRole }) => {
      dispatch(setMemberRole(update));
    });
    channel.on('presence_state', (state: PresenceState) => {
      const members = membersFrom(state);
      members.forEach((member) => {
        dispatch(joinMember(member));
      });
      setPresence(members);
    });
    channel.on('presence_diff', (diff: PresenceDiff) => {
      const joining = membersFrom(diff.joins);
      const leaving = Object.keys(diff.leaves);
      joining.forEach((member) => {
        dispatch(joinMember(member));
      });
      leaving.forEach((id) => {
        dispatch(leaveMember({ id }));
      });
      setPresence((current) => {
        const filtered = current.filter((member) => !leaving.includes(member.id));
        const ids = new Set(filtered.map((member) => member.id));
        return [...filtered, ...joining.filter((member) => !ids.has(member.id))];
      });
    });

    channel
      .join()
      .receive('ok', (payload: { ops: Op[]; roles?: Record<string, MemberRole> }) => {
        dispatch(replayOps(payload.ops));
        dispatch(setRoles(payload.roles ?? {}));
        setJoined(true);
      })
      .receive('error', () => dispatch(leaveRoom()))
      .receive('timeout', () => dispatch(leaveRoom()));

    return () => {
      channel.leave();
      channelRef.current = null;
      dispatch(leaveRoom());
      setJoined(false);
      setPresence([]);
    };
  }, [dispatch, slug, selfId, selfName]);

  const sendOp = useCallback((op: Omit<Op, 'seq' | 'author' | 'ts'>) => {
    channelRef.current?.push('op', op);
  }, []);

  const sendRole = useCallback((memberId: string, role: MemberRole) => {
    channelRef.current?.push('set_role', { member_id: memberId, role });
  }, []);

  return { joined, presence, sendOp, sendRole };
}
