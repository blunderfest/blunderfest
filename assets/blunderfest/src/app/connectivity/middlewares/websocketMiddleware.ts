import { Middleware, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store';
import { selectChannel } from '../actions/actions';

const isLocalAction = (
  action: unknown
): action is PayloadAction<
  object,
  string,
  { roomCode: string; remote: boolean },
  unknown
> => {
  return (
    typeof action === 'object' &&
    action !== null &&
    'meta' in action &&
    action.meta !== null &&
    typeof action.meta === 'object' &&
    'roomCode' in action['meta']
  );
};

export const websocketMiddleware: Middleware<unknown, RootState> = () => {
  return (next) => {
    return (action) => {
      const result = next(action);

      if (isLocalAction(action) && !action.meta.remote) {
        const channel = selectChannel(action.meta.roomCode);

        if (channel) {
          channel.push(action.type, action.payload);
        }
      }

      return result;
    };
  };
};
