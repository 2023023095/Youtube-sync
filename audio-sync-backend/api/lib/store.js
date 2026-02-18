import { Redis } from '@upstash/redis'

const memoryStore = globalThis.__audioSyncRooms ?? new Map()
globalThis.__audioSyncRooms = memoryStore

const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)
const redis = isRedisConfigured ? Redis.fromEnv() : null
const requireRedis = process.env.REQUIRE_REDIS === 'true'

export const ensureStoreAvailable = () => {
  if (requireRedis && !isRedisConfigured) {
    throw new Error(
      'Redis is required but not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    )
  }

  if (!isRedisConfigured && !globalThis.__audioSyncStoreFallbackWarned) {
    globalThis.__audioSyncStoreFallbackWarned = true
    console.warn(
      '[audio-sync] Redis is not configured. Falling back to in-memory store; data is ephemeral on serverless instances.'
    )
  }
}

const keyFor = (roomId) => `audio-sync:room:${roomId}`

export const getRoom = async (roomId) => {
  if (isRedisConfigured) {
    return (await redis.get(keyFor(roomId))) ?? null
  }

  return memoryStore.get(roomId) ?? null
}

export const setRoom = async (roomId, room) => {
  if (isRedisConfigured) {
    await redis.set(keyFor(roomId), room, { ex: 60 * 60 * 12 })
    return
  }

  memoryStore.set(roomId, room)
}

export const deleteRoom = async (roomId) => {
  if (isRedisConfigured) {
    await redis.del(keyFor(roomId))
    return
  }

  memoryStore.delete(roomId)
}

export const sanitizeRoom = (room) => {
  if (!room) {
    return null
  }

  return {
    id: room.id,
    hostUserId: room.hostUserId,
    users: room.users ?? [],
    media: room.media ?? null,
    playback: room.playback ?? { seq: 0, status: 'stopped', actorId: null, updatedAt: Date.now() }
  }
}

export const touchUser = (room, userId) => {
  if (!room || !userId) {
    return room
  }

  const now = Date.now()
  room.users = (room.users ?? []).map((user) => {
    if (user.id !== userId) {
      return user
    }

    return { ...user, lastSeenAt: now }
  })

  const staleCutoff = now - 1000 * 60 * 5
  room.users = room.users.filter((user) => (user.lastSeenAt ?? now) >= staleCutoff)

  if (!room.users.some((user) => user.id === room.hostUserId) && room.users.length > 0) {
    room.hostUserId = room.users[0].id
  }

  room.users = room.users.map((user) => ({ ...user, isHost: user.id === room.hostUserId }))

  return room
}

export const getStoreStatus = () => ({
  mode: isRedisConfigured ? 'redis' : 'memory',
  isRedisConfigured,
  requireRedis
})
