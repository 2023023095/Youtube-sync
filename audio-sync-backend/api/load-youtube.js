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

    const { roomId, userId, videoId, url } = req.body ?? {}

    if (!roomId || !userId || !videoId || !url) {
      return sendJson(req, res, 400, { error: 'roomId, userId, videoId and url are required' })
    }

    const room = await getRoom(roomId)

    if (!room) {
      return sendJson(req, res, 404, { error: 'Room not found' })
    }

    if (room.hostUserId !== userId) {
      return sendJson(req, res, 403, { error: 'Only host can load YouTube audio' })
    }

    const now = Date.now()
    room.media = {
      type: 'youtube',
      videoId,
      url,
      fileName: `YouTube: ${videoId}`,
      updatedAt: now,
      actorId: userId
    }
    room.playback = {
      seq: (room.playback?.seq ?? 0) + 1,
      status: 'stopped',
      actorId: userId,
      updatedAt: now
    }

    await setRoom(roomId, room)

    return sendJson(req, res, 200, { room: sanitizeRoom(room) })
  } catch (error) {
    return sendJson(req, res, 500, { error: error.message || 'Failed to load YouTube audio' })
  }
}
