import type { Channel, ChannelState } from 'phoenix';
import { vi } from 'vitest';
import type { MemberRole, Op } from '@/protocol/ops';

export type Handler = (response?: unknown) => void | Promise<void>;

export class FakeChannel implements Channel {
  handlers = new Map<string, Handler[]>();
  pushes: { event: string; payload: unknown }[] = [];
  joined = false;
  joinParams: Record<string, string> = {};
  joinReturn: {
    ops: Op[];
    roles?: Record<string, MemberRole>;
    region?: string;
    room_region?: string;
    read_only?: boolean;
  } = { ops: [] };
  joinError: { reason?: string } | null = null;
  /** When true, join() does not answer until resolveJoin()/rejectJoin() is called. */
  joinPending = false;
  joinReceives = new Map<string, Handler>();
  state = 'joined' as ChannelState;
  topic = 'room:test';

  onMessage(_event: string, payload: unknown) {
    return payload;
  }

  onClose(_callback: (payload: unknown, ref: unknown, joinRef: unknown) => void) {
    return 1;
  }

  onError(_callback: (reason?: unknown) => void) {
    return 1;
  }

  on(event: string, handler: Handler) {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler]);
    return 1;
  }

  off(_event: string) {}

  emit(event: string, payload: unknown) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
    return this;
  }

  join() {
    this.joined = true;
    const push = {
      receive: (event: string, handler: Handler) => {
        this.joinReceives.set(event, handler);
        if (!this.joinPending) {
          if (event === 'ok' && this.joinError === null) {
            handler(this.joinReturn);
          } else if (event === 'error' && this.joinError !== null) {
            handler(this.joinError);
          }
        }
        return push;
      },
    };
    return push as never;
  }

  /** Answers a pending join with the ok payload (see `joinPending`). */
  resolveJoin() {
    this.joinReceives.get('ok')?.(this.joinReturn);
  }

  leave() {
    this.joined = false;
    return { receive: vi.fn() } as never;
  }

  push(event: string, payload: unknown) {
    this.pushes.push({ event, payload });
    return { receive: vi.fn() } as never;
  }
}
