import { handleOptions, sendJson } from './lib/http.js'
import { ensureStoreAvailable, getRoom, sanitizeRoom, setRoom } from './lib/store.js'

const allowedActions = new Set(['play', 'pause', 'stop'])

export default async function handler(req, res) {
  if (handleOptions(req, res)) {
    return
  }

  if (req.method !== 'POST') {
    return sendJson(req, res, 405, { error: 'Method not allowed' })
  }

  try {
    ensureStoreAvailable()

    const { roomId, userId, action } = req.body ?? {}

    if (!roomId || !userId || !action) {
      return sendJson(req, res, 400, { error: 'roomId, userId and action are required' })
    }

    if (!allowedActions.has(action)) {
      return sendJson(req, res, 400, { error: 'Unsupported action' })
    }

    const room = await getRoom(roomId)

    if (!room) {
      return sendJson(req, res, 404, { error: 'Room not found' })
    }

    const now = Date.now()
    room.playback = {
      seq: (room.playback?.seq ?? 0) + 1,
      status: action === 'play' ? 'playing' : action === 'pause' ? 'paused' : 'stopped',
      actorId: userId,
      updatedAt: now
    }

    await setRoom(roomId, room)

    return sendJson(req, res, 200, { room: sanitizeRoom(room) })
  } catch (error) {
    return sendJson(req, res, 500, { error: error.message || 'Failed to update playback' })
  }
}
