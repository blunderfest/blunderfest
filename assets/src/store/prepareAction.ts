export function prepareAction<TPayload>(payload: TPayload) {
  return {
    payload,
    meta: {
      userId: window.config.userId,
      roomCode: window.config.roomCode,
    },
  };
}
