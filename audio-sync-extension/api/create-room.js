import { handleOptions, sendJson } from './lib/http.js'
import { ensureStoreAvailable, sanitizeRoom, setRoom } from './lib/store.js'

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

    const now = Date.now()

    const room = {
      id: roomId,
      hostUserId: userId,
      users: [
        {
          id: userId,
          username,
          isHost: true,
          joinedAt: now,
          lastSeenAt: now
        }
      ],
      media: null,
      playback: {
        seq: 0,
        status: 'stopped',
        positionSec: 0,
        actorId: null,
        updatedAt: now
      }
    }

    await setRoom(roomId, room)

    return sendJson(req, res, 200, { room: sanitizeRoom(room) })
  } catch (error) {
    return sendJson(req, res, 500, { error: error.message || 'Failed to create room' })
  }
}
