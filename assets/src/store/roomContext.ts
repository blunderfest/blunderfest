/**
 * React bindings for the room store. The store is created per room (and per
 * test) and provided through context, so concurrent rooms and isolated tests
 * never share state. Components read via `useRoomSelector` — the channel is
 * the only writer, so there is no dispatch hook to reach for.
 */

import type { StoreSnapshot } from '@xstate/store';
import { useSelector } from '@xstate/store-react';
import { createContext, useContext, useRef } from 'react';
import type { RoomContext, RoomStore } from '@/store/roomStore';

const RoomStoreContext = createContext<RoomStore | null>(null);

export const RoomStoreProvider = RoomStoreContext.Provider;

/** The current room's store. Throws outside a provider (a wiring bug). */
export function useRoomStore(): RoomStore {
  const store = useContext(RoomStoreContext);
  if (store === null) {
    throw new Error('useRoomStore must be used within a RoomStoreProvider');
  }
  return store;
}

/**
 * Reads a derived value from the room store, re-rendering when it changes.
 *
 * `useSelector`'s memoization caches per selector-function identity, so the
 * snapshot selector must be referentially stable across renders — a fresh
 * inline closure every render would reset its cache and loop on any selector
 * that allocates. The latest context selector is kept in a ref so the stable
 * snapshot selector always calls the current one.
 */
export function useRoomSelector<T>(
  selector: (ctx: RoomContext) => T,
  compare?: (a: T | undefined, b: T) => boolean,
): T {
  const store = useRoomStore();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const snapshotSelectorRef = useRef<((snapshot: StoreSnapshot<RoomContext>) => T) | null>(null);
  snapshotSelectorRef.current ??= (snapshot) => selectorRef.current(snapshot.context);
  return useSelector(store, snapshotSelectorRef.current, compare);
}
