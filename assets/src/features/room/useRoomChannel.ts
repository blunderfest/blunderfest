import type { Channel } from 'phoenix';
import { useCallback, useEffect, useRef, useState } from 'react';
import { channelFor } from '@/lib/socket';
import type { Op } from '@/protocol/ops';
import { useAppDispatch } from '@/store';
import { applyOp, enterRoom, joinMember, leaveMember, leaveRoom, replayOps } from '@/store/room';

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
  channelFactory: (topic: string) => Channel = channelFor,
) {
  const dispatch = useAppDispatch();
  const channelRef = useRef<Channel | null>(null);
  const [joined, setJoined] = useState(false);
  const [presence, setPresence] = useState<RoomPresenceMember[]>([]);

  useEffect(() => {
    const channel = channelFactory(`room:${slug}`);
    channelRef.current = channel;

    dispatch(enterRoom({ slug }));

    channel.on('new_op', (op: Op) => {
      dispatch(applyOp(op));
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
      setPresence((current) => [
        ...current.filter((member) => !leaving.includes(member.id)),
        ...joining,
      ]);
    });

    channel
      .join()
      .receive('ok', (payload: { ops: Op[] }) => {
        dispatch(replayOps(payload.ops));
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
  }, [dispatch, slug, channelFactory]);

  const sendOp = useCallback((op: Omit<Op, 'seq' | 'author' | 'ts'>) => {
    channelRef.current?.push('op', op);
  }, []);

  return { joined, presence, sendOp };
}
