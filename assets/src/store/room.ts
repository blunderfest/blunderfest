import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Op, PresenceMember } from '../protocol/ops'

export type RoomState = {
  slug: string | null
  ops: Op[]
  presence: Record<string, PresenceMember>
}

const initialState: RoomState = {
  slug: null,
  ops: [],
  presence: {},
}

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    enterRoom(state, action: PayloadAction<{ slug: string }>) {
      state.slug = action.payload.slug
      state.ops = []
      state.presence = {}
    },
    leaveRoom(state) {
      state.slug = null
      state.ops = []
      state.presence = {}
    },
    applyOp(state, action: PayloadAction<Op>) {
      const op = action.payload
      const lastSeq = state.ops.length > 0 ? state.ops[state.ops.length - 1].seq : -1
      if (op.seq > lastSeq) {
        state.ops.push(op)
      }
    },
    replayOps(state, action: PayloadAction<Op[]>) {
      state.ops = [...action.payload].sort((a, b) => a.seq - b.seq)
    },
    joinMember(state, action: PayloadAction<PresenceMember>) {
      state.presence[action.payload.id] = action.payload
    },
    leaveMember(state, action: PayloadAction<{ id: string }>) {
      delete state.presence[action.payload.id]
    },
  },
})

export const { enterRoom, leaveRoom, applyOp, replayOps, joinMember, leaveMember } =
  roomSlice.actions

export default roomSlice.reducer
