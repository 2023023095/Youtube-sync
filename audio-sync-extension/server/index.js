import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

const getRoomState = (room) => ({
  users: room.users,
  audioUrl: room.audioUrl ? { url: room.audioUrl, fileName: room.fileName } : null,
  youtube: room.youtube
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', ({ roomId, username }) => {
    const room = {
      id: roomId,
      host: socket.id,
      users: [],
      audioUrl: null,
      fileName: null,
      youtube: null
    };

    rooms.set(roomId, room);

    const user = {
      id: socket.id,
      username,
      isHost: true
    };

    room.users.push(user);
    socket.join(roomId);

    socket.emit('room-joined', getRoomState(room));

    console.log(`Room ${roomId} created by ${username}`);
  });

  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const user = {
      id: socket.id,
      username,
      isHost: false
    };

    room.users.push(user);
    socket.join(roomId);

    socket.emit('room-joined', getRoomState(room));
    socket.to(roomId).emit('user-joined', user);

    console.log(`${username} joined room ${roomId}`);
  });

  socket.on('load-youtube', ({ roomId, videoId, url }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.host !== socket.id) {
      socket.emit('error', { message: 'Only host can load YouTube audio' });
      return;
    }

    room.youtube = { videoId, url };
    io.to(roomId).emit('youtube-loaded', room.youtube);
    console.log(`YouTube loaded in room ${roomId}: ${videoId}`);
  });

  socket.on('load-audio', ({ roomId, url, fileName }) => {
    const room = rooms.get(roomId);

    if (room) {
      room.audioUrl = url;
      room.fileName = fileName;

      socket.to(roomId).emit('audio-loaded', { url, fileName });
      console.log(`Audio loaded in room ${roomId}: ${fileName}`);
    }
  });

  socket.on('play', ({ roomId }) => {
    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    io.to(roomId).emit('play-audio');
    console.log(`Play audio in room ${roomId}`);
  });

  socket.on('pause', ({ roomId }) => {
    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    io.to(roomId).emit('pause-audio');
    console.log(`Pause audio in room ${roomId}`);
  });

  socket.on('stop', ({ roomId }) => {
    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    io.to(roomId).emit('stop-audio');
    console.log(`Stop audio in room ${roomId}`);
  });

  socket.on('seek', ({ roomId, time }) => {
    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    if (room.host !== socket.id) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    socket.to(roomId).emit('seek-audio', time);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex((u) => u.id === socket.id);

      if (userIndex !== -1) {
        room.users.splice(userIndex, 1);

        socket.to(roomId).emit('user-left', socket.id);

        if (room.users.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else if (room.host === socket.id) {
          room.host = room.users[0].id;
          room.users[0].isHost = true;
          io.to(roomId).emit('users-list', room.users);
          console.log(`New host for room ${roomId}: ${room.users[0].username}`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
