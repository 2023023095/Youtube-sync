# Audio Sync - Listen Together

A browser extension that allows you to listen to audio together with friends in real-time. When one person plays, pauses, or stops audio, everyone in the room synchronization is key - ensuring all friends experience the same audio playback simultaneously.

## Features

- 🎵 **Room-based System** - Create or join rooms to listen with friends
- 🔄 **Real-time Sync** - All users hear the same audio at the same time
- 🎮 **Host Control** - One person controls playback for everyone
- 🌍 **Cross-browser** - Works on Chrome, Firefox, and Edge
- 📁 **All Audio Formats** - Supports local files, URLs, and streaming audio

## How It Works

1. **Create a Room** - Click "Create New Room" to generate a unique room code
2. **Share the Code** - Share the room code with your friends
3. **Join the Room** - Friends enter the code to join
4. **Load Audio** - Anyone can load an audio file
5. **Sync Playback** - When play/pause/stop is triggered, everyone in the room synchronized

## Installation

### Development Mode

1. Install dependencies:
```
bash
npm install
```

2. Start the WebSocket server:
```
bash
npm run server
```

3. Start the React development server:
```
bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### As Browser Extension

#### Chrome/Edge
1. Build the React app: `npm run build`
2. Open Chrome/Edge and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

#### Firefox
1. Build the React app: `npm run build`
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on" and select any file in the `dist` folder

## Tech Stack

- **Frontend**: React + Vite
- **Real-time**: Socket.io
- **Backend**: Express + Socket.io Server
- **Browser Extension**: Manifest V3 (Chrome), Manifest V2 (Firefox)

## Project Structure

```
audio-sync-extension/
├── src/
│   ├── App.jsx        # Main React component
│   ├── main.jsx      # React entry point
│   └── index.css     # Styles
├── server/
│   └── index.js      # WebSocket server
├── extension/
│   ├── manifest.json        # Chrome/Edge manifest
│   └── manifest-firefox.json # Firefox manifest
├── package.json
└── vite.config.js
```

## License

MIT
