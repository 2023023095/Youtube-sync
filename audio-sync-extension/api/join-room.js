import { handleOptions, sendJson } from './lib/http.js'
import { ensureStoreAvailable, getRoom, sanitizeRoom, setRoom, touchUser } from './lib/store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) {
    return
  }

  if (req.method !== 'POST') {
    return sendJson(req, res, 405, { error: 'Method not allowed' })
  }

  try {
    ensureStoreAvailable()

    const { roomId, username, userId } = req.body ?? {}

    if (!roomId || !username || !userId) {
      return sendJson(req, res, 400, { error: 'roomId, username and userId are required' })
    }

    const room = await getRoom(roomId)

    if (!room) {
      return sendJson(req, res, 404, { error: 'Room not found' })
    }

    const now = Date.now()
    const existing = room.users.find((user) => user.id === userId)

    if (existing) {
      room.users = room.users.map((user) =>
        user.id === userId ? { ...user, username, lastSeenAt: now } : user
      )
    } else {
      room.users.push({
        id: userId,
        username,
        isHost: false,
        joinedAt: now,
        lastSeenAt: now
      })
    }

    touchUser(room, userId)
    await setRoom(roomId, room)

    return sendJson(req, res, 200, { room: sanitizeRoom(room) })
  } catch (error) {
    return sendJson(req, res, 500, { error: error.message || 'Failed to join room' })
  }
}
