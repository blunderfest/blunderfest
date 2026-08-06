import type { Channel, ChannelState } from 'phoenix';
import { vi } from 'vitest';
import type { Op } from '@/protocol/ops';

export type Handler = (response?: unknown) => void | Promise<void>;

export class FakeChannel implements Channel {
  handlers = new Map<string, Handler[]>();
  pushes: { event: string; payload: unknown }[] = [];
  joined = false;
  joinReturn: { ops: Op[] } = { ops: [] };
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
        if (event === 'ok') {
          handler(this.joinReturn);
        }
        return push;
      },
    };
    return push as never;
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
