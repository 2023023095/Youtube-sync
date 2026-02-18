import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { io } from 'socket.io-client'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://youtube-sync-two.vercel.app').replace(/\/$/, '')
const WS_URL = (import.meta.env.VITE_WS_URL || '').replace(/\/$/, '')

const getStoredUserId = () => {
  const key = 'audio-sync-user-id'
  const existing = localStorage.getItem(key)
  if (existing) {
    return existing
  }

  const created = uuidv4()
  localStorage.setItem(key, created)
  return created
}

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

function App() {
  const [userId] = useState(getStoredUserId)
  const [roomId, setRoomId] = useState('')
  const [username, setUsername] = useState('')
  const [isInRoom, setIsInRoom] = useState(false)
  const [users, setUsers] = useState([])
  const [mediaType, setMediaType] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [nowPlaying, setNowPlaying] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeVideoId, setYoutubeVideoId] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const playerRef = useRef(null)
  const audioRef = useRef(null)
  const mediaTypeRef = useRef('')
  const lastPlaybackSeqRef = useRef(0)
  const isPlayerReadyRef = useRef(false)
  const pendingActionRef = useRef(null)
  const loadedVideoIdRef = useRef('')
  const socketRef = useRef(null)

  const currentUser = useMemo(() => users.find((user) => user.id === userId), [users, userId])
  const isHost = Boolean(currentUser?.isHost)

  useEffect(() => {
    mediaTypeRef.current = mediaType
  }, [mediaType])

  useEffect(() => {
    if (window.YT?.Player) {
      return
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
  }, [])

  const extractVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const applyPlayerAction = (action) => {
    if (!playerRef.current || !isPlayerReadyRef.current) {
      pendingActionRef.current = action
      return
    }

    if (action === 'play') {
      playerRef.current.playVideo()
      setIsPlaying(true)
    } else if (action === 'pause') {
      playerRef.current.pauseVideo()
      setIsPlaying(false)
    } else {
      playerRef.current.stopVideo()
      setIsPlaying(false)
    }
  }

  const createYouTubePlayer = (videoId) => {
    if (!videoId) {
      return
    }

    if (!window.YT?.Player) {
      setTimeout(() => createYouTubePlayer(videoId), 300)
      return
    }

    if (playerRef.current) {
      if (loadedVideoIdRef.current === videoId) {
        return
      }
      playerRef.current.loadVideoById(videoId)
      loadedVideoIdRef.current = videoId
      return
    }

    playerRef.current = new window.YT.Player('youtube-player', {
      height: '0',
      width: '0',
      videoId,
      playerVars: {
        playsinline: 1,
        controls: 0,
        autoplay: 0,
        enablejsapi: 1
      },
      events: {
        onReady: () => {
          isPlayerReadyRef.current = true
          loadedVideoIdRef.current = videoId

          if (pendingActionRef.current) {
            const action = pendingActionRef.current
            pendingActionRef.current = null
            applyPlayerAction(action)
          }
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true)
          }
          if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false)
          }
        }
      }
    })
  }

  const apiPost = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    return parseResponse(response)
  }

  const syncRoomState = (room, incomingRoomId) => {
    if (!room) {
      return
    }

    if (incomingRoomId) {
      setRoomId(incomingRoomId)
    }

    setUsers(room.users || [])

    if (room.media?.type === 'local') {
      setMediaType('local')
      setAudioUrl(room.media.url || '')
      setNowPlaying(room.media.fileName || 'Shared audio')
      setYoutubeVideoId('')
      loadedVideoIdRef.current = ''
    } else if (room.media?.type === 'youtube') {
      setMediaType('youtube')
      setYoutubeVideoId(room.media.videoId || '')
      setYoutubeUrl(room.media.url || '')
      setNowPlaying(room.media.fileName || `YouTube: ${room.media.videoId}`)
      setAudioUrl('')
      if (room.media.videoId) {
        createYouTubePlayer(room.media.videoId)
      }
    }

    const playback = room.playback
    if (!playback || playback.seq === undefined) {
      return
    }

    if (playback.seq === lastPlaybackSeqRef.current) {
      return
    }

    lastPlaybackSeqRef.current = playback.seq

    const targetMediaType = room.media?.type || mediaTypeRef.current
    if (targetMediaType === 'local' && audioRef.current) {
      if (playback.status === 'playing') {
        audioRef.current.play().catch(() => {})
        setIsPlaying(true)
      } else if (playback.status === 'paused') {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
      }
      return
    }

    if (playback.status === 'playing') {
      applyPlayerAction('play')
    } else if (playback.status === 'paused') {
      applyPlayerAction('pause')
    } else {
      applyPlayerAction('stop')
    }
  }

  const refreshRoomState = useCallback(async () => {
    if (!isInRoom || !roomId) {
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/room?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`
      )
      const data = await parseResponse(response)
      syncRoomState(data.room, roomId)
    } catch (pollError) {
      setError(pollError.message)
    }
  }, [isInRoom, roomId, userId])

  useEffect(() => {
    if (!isInRoom || !roomId) {
      return
    }

    refreshRoomState()
    window.addEventListener('online', refreshRoomState)

    return () => {
      window.removeEventListener('online', refreshRoomState)
    }
  }, [isInRoom, roomId, refreshRoomState])

  useEffect(() => {
    if (!WS_URL || !isInRoom || !roomId) {
      return
    }

    const socket = socketRef.current ?? io(WS_URL)
    socketRef.current = socket

    const joinRoomChannel = () => {
      socket.emit('join-room-channel', { roomId, userId })
    }

    const handleConnect = () => {
      joinRoomChannel()
    }

    const handleRoomUpdated = (event) => {
      if (!event || event.roomId !== roomId) {
        return
      }
      refreshRoomState()
    }

    const handleControlEvent = (event) => {
      if (!event || event.roomId !== roomId || !event.action) {
        return
      }

      if (event.action === 'play') {
        applyPlayerAction('play')
      } else if (event.action === 'pause') {
        applyPlayerAction('pause')
      } else if (event.action === 'stop') {
        applyPlayerAction('stop')
      }
    }

    if (socket.connected) {
      handleConnect()
    }

    socket.on('connect', handleConnect)
    socket.on('room-updated', handleRoomUpdated)
    socket.on('control-event', handleControlEvent)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('room-updated', handleRoomUpdated)
      socket.off('control-event', handleControlEvent)
      socket.emit('leave-room-channel', { roomId, userId })
    }
  }, [isInRoom, roomId, refreshRoomState, userId])

  const notifyRoomUpdated = useCallback(
    (eventType) => {
      if (!roomId || !socketRef.current) {
        return
      }

      socketRef.current.emit('notify-room-update', {
        roomId,
        userId,
        eventType
      })
    },
    [roomId, userId]
  )

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
      }
      playerRef.current = null
      loadedVideoIdRef.current = ''
    }
  }, [])

  const createRoom = async () => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    setIsBusy(true)
    setError('')

    try {
      const newRoomId = uuidv4().slice(0, 8)
      const data = await apiPost('create-room', {
        roomId: newRoomId,
        username: username.trim(),
        userId
      })

      lastPlaybackSeqRef.current = data.room?.playback?.seq ?? 0
      setIsInRoom(true)
      syncRoomState(data.room, newRoomId)
      setSuccess('Room created. Share the code with friends.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsBusy(false)
    }
  }

  const joinRoom = async () => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    if (!roomId.trim()) {
      setError('Please enter a room code')
      return
    }

    setIsBusy(true)
    setError('')

    try {
      const data = await apiPost('join-room', {
        roomId: roomId.trim(),
        username: username.trim(),
        userId
      })

      lastPlaybackSeqRef.current = data.room?.playback?.seq ?? 0
      setIsInRoom(true)
      syncRoomState(data.room, roomId.trim())
      setSuccess('Joined room successfully.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (joinError) {
      setError(joinError.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleYoutubeLoad = async () => {
    if (!isHost) {
      setError('Only host can load YouTube audio')
      return
    }

    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      setError('Invalid YouTube URL')
      return
    }

    setIsBusy(true)
    setError('')

    try {
      const data = await apiPost('load-youtube', {
        roomId,
        userId,
        videoId,
        url: youtubeUrl.trim()
      })

      syncRoomState(data.room, roomId)
      notifyRoomUpdated('load-youtube')
      setIsPlaying(false)
      setSuccess('YouTube loaded for everyone in room.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        setError('Failed to read audio file')
        return
      }

      setIsBusy(true)
      setError('')

      try {
        const data = await apiPost('load-audio', {
          roomId,
          userId,
          url: dataUrl,
          fileName: file.name
        })

        syncRoomState(data.room, roomId)
        notifyRoomUpdated('load-audio')
        setIsPlaying(false)
        setSuccess('Audio uploaded to room.')
        setTimeout(() => setSuccess(''), 3000)
      } catch (uploadError) {
        setError(uploadError.message)
      } finally {
        setIsBusy(false)
      }
    }

    reader.readAsDataURL(file)
  }

  const sendControl = async (action) => {
    if (!roomId) {
      return
    }

    try {
      const data = await apiPost('control', { roomId, userId, action })
      syncRoomState(data.room, roomId)
      if (socketRef.current) {
        socketRef.current.emit('broadcast-control', { roomId, userId, action })
      }
      notifyRoomUpdated('control')
    } catch (controlError) {
      setError(controlError.message)
    }
  }

  const playAudio = () => {
    sendControl('play')
  }

  const pauseAudio = () => {
    sendControl('pause')
  }

  const stopAudio = () => {
    sendControl('stop')
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setSuccess('Room code copied.')
    setTimeout(() => setSuccess(''), 2000)
  }

  if (!isInRoom) {
    return (
      <div className="app">
        <h1>Audio Sync</h1>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div className="input-group">
          <label>Your Name</label>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <button className="btn btn-primary" onClick={createRoom} disabled={isBusy}>
          Create New Room
        </button>

        <div style={{ textAlign: 'center', margin: '15px 0', color: '#999' }}>OR</div>

        <div className="input-group">
          <label>Room Code</label>
          <input
            type="text"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="Enter room code"
          />
        </div>

        <button className="btn btn-secondary" onClick={joinRoom} disabled={isBusy}>
          Join Room
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <h1>Audio Sync Room</h1>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="room-info">
        <h3>Room Code: {roomId}</h3>
        <button className="btn btn-secondary" onClick={copyRoomId} style={{ padding: '8px', fontSize: '14px' }}>
          Copy Code
        </button>
      </div>

      <div className="audio-controls">
        <div className="file-input">
          <input type="file" id="audio-file" accept="audio/*" onChange={handleFileSelect} disabled={isBusy} />
          <label htmlFor="audio-file">Choose Audio File</label>
        </div>

        <div className="input-group">
          <label>YouTube URL {isHost ? '(Host)' : '(View only)'}</label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={!isHost || isBusy}
          />
        </div>

        <button className="btn btn-primary" onClick={handleYoutubeLoad} disabled={!isHost || isBusy}>
          Load YouTube Audio
        </button>

        <div className="playback-controls">
          <button className="play-btn" onClick={playAudio} disabled={!roomId || isBusy}>
            Play
          </button>
          <button className="pause-btn" onClick={pauseAudio} disabled={!roomId || isBusy}>
            Pause
          </button>
          <button className="stop-btn" onClick={stopAudio} disabled={!roomId || isBusy}>
            Stop
          </button>
        </div>

        {(nowPlaying || youtubeVideoId) && (
          <div className="now-playing">
            <h4>Now Playing</h4>
            <p>{nowPlaying || `YouTube: ${youtubeVideoId}`}</p>
          </div>
        )}
      </div>

      <div className="users-list">
        <h4>Friends in Room ({users.length})</h4>
        <ul>
          {users.map((user) => (
            <li key={user.id}>
              <span className="status-dot"></span>
              {user.username} {user.isHost ? '(Host)' : ''}
            </li>
          ))}
        </ul>
      </div>

      <div id="youtube-player" />
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
    </div>
  )
}

export default App
