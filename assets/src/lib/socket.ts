import { Socket } from 'phoenix'
import { loadDevice } from '@/lib/device'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = new Socket('/socket', {
      params: { profile_id: loadDevice()?.id ?? null },
    })
    socket.connect()
  }
  return socket
}

export function channelFor(topic: string) {
  return getSocket().channel(topic)
}
