import { handleOptions, sendJson } from './lib/http.js'
import { ensureStoreAvailable, getRoom, sanitizeRoom, setRoom, touchUser } from './lib/store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) {
    return
  }

  if (req.method !== 'GET') {
    return sendJson(req, res, 405, { error: 'Method not allowed' })
  }

  try {
    ensureStoreAvailable()

    const { roomId, userId } = req.query ?? {}

    if (!roomId) {
      return sendJson(req, res, 400, { error: 'roomId is required' })
    }

    const room = await getRoom(roomId)

    if (!room) {
      return sendJson(req, res, 404, { error: 'Room not found' })
    }

    if (userId) {
      touchUser(room, userId)
      await setRoom(roomId, room)
    }

    return sendJson(req, res, 200, { room: sanitizeRoom(room) })
  } catch (error) {
    return sendJson(req, res, 500, { error: error.message || 'Failed to fetch room' })
  }
}
