import { createAsyncThunk } from '@reduxjs/toolkit';
import { Socket } from 'phoenix';

const socket = new Socket('/socket', { params: { token: window.userToken } });

const channels: Record<string, import('phoenix').Channel> = {};

export const connect = createAsyncThunk('connect', () => {
  return new Promise<void>((resolve, reject) => {
    socket.connect();
    socket.onOpen(() => resolve());
    socket.onError((e) => {
      console.error(e);
      reject();
    });
  });
});

export const disconnect = createAsyncThunk('disconnect', () => {
  return new Promise<void>((resolve) => {
    socket.disconnect();
    resolve();
  });
});

type JoinParams = {
  userId: string;
  roomCode: string;
};

export const join = createAsyncThunk(
  'join',
  (params: JoinParams, { dispatch }) => {
    const { userId, roomCode } = params;

    return new Promise<JoinParams>((resolve, reject) => {
      const channel = socket.channel('room:' + roomCode, {
        user_id: userId,
      });

      channels[roomCode] = channel;

      channel
        .join()
        .receive('ok', () => resolve(params))
        .receive('error', (resp) => {
          console.error(resp);
          return reject({ message: 'Unable to join', resp });
        });

      channel.onMessage = (event, payload) => {
        dispatch({
          type: event,
          payload,
          meta: {
            remote: true,
          },
        });

        return payload;
      };

      channel.onClose(() => {
        if (channel.state !== 'leaving') {
          dispatch(leave({ roomCode: roomCode }));
        }
      });

      channel.onError((reason) => reject(reason));
    });
  }
);

type LeaveParams = { roomCode: string };

export const leave = createAsyncThunk('leave', (params: LeaveParams) => {
  return new Promise<LeaveParams>((resolve, reject) => {
    const channel = channels[params.roomCode];

    if (!channel || channel.state !== 'joined') {
      reject();
    } else {
      if (channel.state === 'joined') {
        channel.leave();
      }

      delete channels[params.roomCode];
      resolve(params);
    }
  });
});

export const selectChannel = (roomCode: string) => channels[roomCode];
