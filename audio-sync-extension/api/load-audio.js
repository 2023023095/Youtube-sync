import { handleOptions, sendJson } from './lib/http.js'
import { ensureStoreAvailable, getRoom, sanitizeRoom, setRoom } from './lib/store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) {
    return
  }

  if (req.method !== 'POST') {
    return sendJson(req, res, 405, { error: 'Method not allowed' })
  }

  try {
    ensureStoreAvailable()

    const { roomId, userId, url, fileName } = req.body ?? {}

    if (!roomId || !userId || !url) {
      return sendJson(req, res, 400, { error: 'roomId, userId and url are required' })
    }

    const room = await getRoom(roomId)

    if (!room) {
      return sendJson(req, res, 404, { error: 'Room not found' })
    }

    const now = Date.now()
    room.media = {
      type: 'local',
      url,
      fileName: fileName || 'Shared audio',
      updatedAt: now,
      actorId: userId
    }
    room.playback = {
      seq: (room.playback?.seq ?? 0) + 1,
      status: 'stopped',
      positionSec: 0,
      actorId: userId,
      updatedAt: now
    }

    await setRoom(roomId, room)

    return sendJson(req, res, 200, { room: sanitizeRoom(room) })
  } catch (error) {
    return sendJson(req, res, 500, { error: error.message || 'Failed to load audio' })
  }
}
