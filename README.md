# StudyMate Collaborative Mode

A real-time collaborative study platform that allows multiple friends to study together by sharing PDFs, making annotations, chatting, and screen sharing.

## Features

### 🏠 Room-Based System
- Create study rooms with unique room codes
- Join existing rooms using room codes
- Real-time user presence tracking

### 📄 PDF Collaboration
- Upload and share PDF documents
- Real-time PDF viewing for all participants
- Synchronized page navigation

### ✏️ Live Annotations
- Highlight text in PDFs
- Add sticky notes with custom colors
- Real-time synchronization of all annotations
- Edit and delete your own annotations

### 💬 Real-Time Chat
- Text chat for discussions
- System notifications for user activities
- Message history during session

### 🖥️ Screen Sharing
- Share your screen with other participants
- Similar to AnyDesk functionality
- Toggle between PDF view and screen share

## Installation

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application**
   ```bash
   python collaborative_mode.py
   ```

3. **Access the Application**
   - Open your browser and go to `http://localhost:5000`
   - Create a new room or join an existing one

## How to Use

### Creating a Study Room
1. Enter your name
2. Click "Create Room"
3. Share the generated room code with friends
4. Click "Enter Room" to start studying

### Joining a Study Room
1. Enter your name
2. Enter the room code shared by your friend
3. Click "Join Room"

### In the Study Room

#### PDF Features
- **Upload PDF**: Click "Upload PDF" to share a document
- **View PDFs**: Click on any uploaded PDF to view it
- **Annotations**: 
  - Click "Highlight" to highlight text
  - Click "Note" to add sticky notes
  - Click "Select" to return to normal mode

#### Screen Sharing
- Click "Share Screen" to start screen sharing
- Select the screen/window you want to share
- Click "Stop Sharing" to end screen sharing

#### Chat
- Type messages in the chat box
- Press Enter to send messages
- See when users join/leave the room

## Technical Details

### Backend
- **Flask**: Web framework
- **Flask-SocketIO**: Real-time communication
- **Eventlet**: Async server

### Frontend
- **Bootstrap 5**: UI framework
- **Socket.IO**: Real-time client communication
- **PDF.js**: PDF rendering
- **WebRTC**: Screen sharing

### File Structure
```
├── collaborative_mode.py      # Main Flask application
├── requirements.txt           # Python dependencies
├── templates/
│   ├── index.html            # Home page
│   └── study_room.html       # Study room interface
├── static/
│   ├── css/
│   │   ├── style.css         # Home page styles
│   │   └── study_room.css    # Study room styles
│   └── js/
│       ├── index.js          # Home page functionality
│       └── study_room.js     # Study room functionality
└── uploads/                  # PDF storage directory
```

## Browser Compatibility

- **Chrome/Chromium**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Limited screen sharing support
- **Edge**: Full support

## Security Notes

- Room codes are temporary and expire when empty
- Files are stored locally (consider cloud storage for production)
- No user authentication (add for production use)

## Limitations

- Files are stored in memory (restart clears all data)
- No persistent chat history
- Maximum file size: 50MB
- Screen sharing requires HTTPS in production

## Future Enhancements

- User authentication and profiles
- Persistent data storage (database)
- Voice/video calling
- Whiteboard functionality
- File version control
- Mobile app support

## Troubleshooting

### Common Issues

1. **Connection Issues**
   - Check if port 5000 is available
   - Ensure firewall allows the connection

2. **PDF Not Loading**
   - Check file size (must be under 50MB)
   - Ensure file is a valid PDF

3. **Screen Sharing Not Working**
   - Use HTTPS for production
   - Grant browser permissions
   - Try Chrome/Firefox for best support

4. **Annotations Not Syncing**
   - Check internet connection
   - Refresh the page if issues persist

## Support

For issues or feature requests, please check the console logs and ensure all dependencies are properly installed.
