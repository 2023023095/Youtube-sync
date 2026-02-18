import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'

const serverUrl = 'http://localhost:3001'

function App() {
  const [socket, setSocket] = useState(null)
  const [socketId, setSocketId] = useState('')
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

  const playerRef = useRef(null)
  const audioRef = useRef(null)
  const mediaTypeRef = useRef('')
  const isPlayerReadyRef = useRef(false)
  const pendingActionRef = useRef(null)

  const currentUser = useMemo(() => users.find((u) => u.id === socketId), [users, socketId])
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
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const flushPendingAction = () => {
    if (!playerRef.current || !isPlayerReadyRef.current || !pendingActionRef.current) {
      return
    }

    const action = pendingActionRef.current
    pendingActionRef.current = null

    if (action === 'play') {
      playerRef.current.playVideo()
      setIsPlaying(true)
    } else if (action === 'pause') {
      playerRef.current.pauseVideo()
      setIsPlaying(false)
    } else if (action === 'stop') {
      playerRef.current.stopVideo()
      setIsPlaying(false)
    }
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
    } else if (action === 'stop') {
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
      playerRef.current.loadVideoById(videoId)
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
          flushPendingAction()
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

  useEffect(() => {
    const newSocket = io(serverUrl)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setSocketId(newSocket.id)
    })

    newSocket.on('user-joined', (user) => {
      setUsers((prev) => [...prev, user])
    })

    newSocket.on('users-list', (usersList) => {
      setUsers(usersList)
    })

    newSocket.on('user-left', (userId) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    })

    newSocket.on('youtube-loaded', (data) => {
      setMediaType('youtube')
      setYoutubeVideoId(data.videoId)
      setYoutubeUrl(data.url)
      setNowPlaying(`YouTube: ${data.videoId}`)
      setIsPlaying(false)
      createYouTubePlayer(data.videoId)
    })

    newSocket.on('audio-loaded', (data) => {
      setMediaType('local')
      setAudioUrl(data.url)
      setNowPlaying(data.fileName || 'Shared audio')
      setIsPlaying(false)
    })

    newSocket.on('play-audio', () => {
      if (mediaTypeRef.current === 'local' && audioRef.current) {
        audioRef.current.play()
        setIsPlaying(true)
      } else {
        applyPlayerAction('play')
      }
    })

    newSocket.on('pause-audio', () => {
      if (mediaTypeRef.current === 'local' && audioRef.current) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        applyPlayerAction('pause')
      }
    })

    newSocket.on('stop-audio', () => {
      if (mediaTypeRef.current === 'local' && audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
      } else {
        applyPlayerAction('stop')
      }
    })

    newSocket.on('room-joined', (data) => {
      setIsInRoom(true)
      setUsers(data.users)
      if (data.audioUrl?.url) {
        setMediaType('local')
        setAudioUrl(data.audioUrl.url)
        setNowPlaying(data.audioUrl.fileName || 'Shared audio')
      }
      if (data.youtube?.videoId) {
        setMediaType('youtube')
        setYoutubeVideoId(data.youtube.videoId)
        setYoutubeUrl(data.youtube.url)
        setNowPlaying(`YouTube: ${data.youtube.videoId}`)
        createYouTubePlayer(data.youtube.videoId)
      }
    })

    newSocket.on('error', (err) => {
      setError(err.message)
      setTimeout(() => setError(''), 4000)
    })

    return () => {
      newSocket.disconnect()
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
      }
      playerRef.current = null
      isPlayerReadyRef.current = false
      pendingActionRef.current = null
    }
  }, [])

  const createRoom = () => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    const newRoomId = uuidv4().slice(0, 8)
    setRoomId(newRoomId)
    socket.emit('create-room', { roomId: newRoomId, username: username.trim() })
    setSuccess('Room created. Share the code with friends.')
    setTimeout(() => setSuccess(''), 3000)
  }

  const joinRoom = () => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    if (!roomId.trim()) {
      setError('Please enter a room code')
      return
    }

    socket.emit('join-room', { roomId: roomId.trim(), username: username.trim() })
  }

  const handleYoutubeLoad = () => {
    if (!isHost) {
      setError('Only host can load YouTube audio')
      return
    }

    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      setError('Invalid YouTube URL')
      return
    }

    setMediaType('youtube')
    setYoutubeVideoId(videoId)
    setNowPlaying(`YouTube: ${videoId}`)
    createYouTubePlayer(videoId)
    socket.emit('load-youtube', { roomId, videoId, url: youtubeUrl.trim() })
    setSuccess('YouTube loaded for everyone in room.')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        setError('Failed to read audio file')
        return
      }

      setMediaType('local')
      setAudioUrl(dataUrl)
      setNowPlaying(file.name)
      setIsPlaying(false)
      socket.emit('load-audio', { roomId, url: dataUrl, fileName: file.name })
      setSuccess('Audio uploaded to room.')
      setTimeout(() => setSuccess(''), 3000)
    }
    reader.readAsDataURL(file)
  }

  const playAudio = () => {
    if (!roomId) {
      return
    }

    if (mediaType === 'local') {
      if (audioRef.current) {
        audioRef.current.play()
        setIsPlaying(true)
      }
      socket.emit('play', { roomId })
      return
    }

    if (youtubeVideoId) {
      applyPlayerAction('play')
    }
    socket.emit('play', { roomId })
  }

  const pauseAudio = () => {
    if (!roomId) {
      return
    }

    if (mediaType === 'local') {
      if (audioRef.current) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
      socket.emit('pause', { roomId })
      return
    }

    if (youtubeVideoId) {
      applyPlayerAction('pause')
    }
    socket.emit('pause', { roomId })
  }

  const stopAudio = () => {
    if (!roomId) {
      return
    }

    if (mediaType === 'local' && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    } else if (playerRef.current) {
      applyPlayerAction('stop')
    }
    socket.emit('stop', { roomId })
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
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <button className="btn btn-primary" onClick={createRoom} disabled={!socket}>
          Create New Room
        </button>

        <div style={{ textAlign: 'center', margin: '15px 0', color: '#999' }}>OR</div>

        <div className="input-group">
          <label>Room Code</label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room code"
          />
        </div>

        <button className="btn btn-secondary" onClick={joinRoom} disabled={!socket}>
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
          <input type="file" id="audio-file" accept="audio/*" onChange={handleFileSelect} />
          <label htmlFor="audio-file">Choose Audio File</label>
        </div>

        <div className="input-group">
          <label>YouTube URL {isHost ? '(Host)' : '(View only)'}</label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={!isHost}
          />
        </div>

        <button className="btn btn-primary" onClick={handleYoutubeLoad} disabled={!isHost}>
          Load YouTube Audio
        </button>

        <div className="playback-controls">
          <button className="play-btn" onClick={playAudio} disabled={!roomId}>
            Play
          </button>
          <button className="pause-btn" onClick={pauseAudio} disabled={!roomId}>
            Pause
          </button>
          <button className="stop-btn" onClick={stopAudio} disabled={!roomId}>
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
