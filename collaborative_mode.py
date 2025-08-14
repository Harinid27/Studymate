from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Initialize SocketIO with CORS enabled
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage for rooms and users (in production, use a database)
active_rooms = {}
room_users = {}
room_pdfs = {}
room_annotations = {}

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def generate_room_code():
    """Generate a unique 6-character room code"""
    return str(uuid.uuid4())[:8].upper()

def is_valid_room_code(room_code):
    """Check if room code exists and is active"""
    return room_code in active_rooms

@app.route('/')
def index():
    """Main page for creating or joining rooms"""
    return render_template('index.html')

@app.route('/room/<room_code>')
def study_room(room_code):
    """Study room interface"""
    if not is_valid_room_code(room_code):
        return "Room not found", 404
    return render_template('study_room.html', room_code=room_code)

@app.route('/api/create_room', methods=['POST'])
def create_room():
    """Create a new study room"""
    data = request.get_json()
    username = data.get('username', 'Anonymous')

    room_code = generate_room_code()

    # Initialize room data
    active_rooms[room_code] = {
        'created_at': datetime.now().isoformat(),
        'creator': username,
        'participants': []
    }
    room_users[room_code] = {}
    room_pdfs[room_code] = []
    room_annotations[room_code] = {}

    return jsonify({
        'success': True,
        'room_code': room_code,
        'message': f'Room {room_code} created successfully'
    })

@app.route('/api/join_room', methods=['POST'])
def join_room_api():
    """Join an existing study room"""
    data = request.get_json()
    room_code = data.get('room_code', '').upper()
    username = data.get('username', 'Anonymous')

    if not is_valid_room_code(room_code):
        return jsonify({
            'success': False,
            'message': 'Room not found'
        }), 404

    return jsonify({
        'success': True,
        'room_code': room_code,
        'message': f'Ready to join room {room_code}'
    })

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Socket.IO event handlers
@socketio.on('connect')
def on_connect():
    """Handle client connection"""
    print(f"Client {request.sid} connected")

@socketio.on('disconnect')
def on_disconnect():
    """Handle client disconnection"""
    print(f"Client {request.sid} disconnected")

    # Remove user from all rooms
    for room_code in list(room_users.keys()):
        if request.sid in room_users[room_code]:
            username = room_users[room_code][request.sid]['username']
            del room_users[room_code][request.sid]

            # Notify other users in the room
            emit('user_left', {
                'username': username,
                'user_count': len(room_users[room_code])
            }, room=room_code)

@socketio.on('join_study_room')
def on_join_study_room(data):
    """Handle user joining a study room"""
    room_code = data['room_code']
    username = data['username']

    if not is_valid_room_code(room_code):
        emit('error', {'message': 'Room not found'})
        return

    # Join the room
    join_room(room_code)

    # Add user to room tracking
    if room_code not in room_users:
        room_users[room_code] = {}

    room_users[room_code][request.sid] = {
        'username': username,
        'joined_at': datetime.now().isoformat()
    }

    # Send current room state to the new user
    emit('room_joined', {
        'room_code': room_code,
        'username': username,
        'pdfs': room_pdfs.get(room_code, []),
        'annotations': room_annotations.get(room_code, {}),
        'user_count': len(room_users[room_code])
    })

    # Notify other users about the new participant
    emit('user_joined', {
        'username': username,
        'user_count': len(room_users[room_code])
    }, room=room_code, include_self=False)

@app.route('/api/upload_pdf', methods=['POST'])
def upload_pdf():
    """Upload a PDF file to a study room"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    file = request.files['file']
    room_code = request.form.get('room_code')
    username = request.form.get('username', 'Anonymous')

    if not room_code or not is_valid_room_code(room_code):
        return jsonify({'success': False, 'message': 'Invalid room code'}), 400

    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400

    if file and file.filename.lower().endswith('.pdf'):
        filename = secure_filename(file.filename)
        # Add timestamp to avoid conflicts
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        unique_filename = f"{timestamp}{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)

        # Add PDF to room
        pdf_info = {
            'id': str(uuid.uuid4()),
            'filename': unique_filename,
            'original_name': filename,
            'uploaded_by': username,
            'uploaded_at': datetime.now().isoformat(),
            'url': f'/uploads/{unique_filename}'
        }

        if room_code not in room_pdfs:
            room_pdfs[room_code] = []
        room_pdfs[room_code].append(pdf_info)

        # Notify all users in the room about the new PDF
        socketio.emit('pdf_uploaded', pdf_info, room=room_code)

        return jsonify({
            'success': True,
            'message': 'PDF uploaded successfully',
            'pdf': pdf_info
        })

    return jsonify({'success': False, 'message': 'Invalid file type. Only PDF files are allowed.'}), 400

@socketio.on('add_annotation')
def on_add_annotation(data):
    """Handle adding annotations to PDFs"""
    room_code = data['room_code']
    pdf_id = data['pdf_id']
    annotation = data['annotation']
    username = data['username']

    if not is_valid_room_code(room_code):
        emit('error', {'message': 'Room not found'})
        return

    # Add annotation with unique ID
    annotation_id = str(uuid.uuid4())
    annotation_data = {
        'id': annotation_id,
        'type': annotation['type'],  # 'highlight', 'note', etc.
        'page': annotation['page'],
        'coordinates': annotation['coordinates'],
        'text': annotation.get('text', ''),
        'color': annotation.get('color', '#ffff00'),
        'created_by': username,
        'created_at': datetime.now().isoformat()
    }

    # Store annotation
    if room_code not in room_annotations:
        room_annotations[room_code] = {}
    if pdf_id not in room_annotations[room_code]:
        room_annotations[room_code][pdf_id] = []

    room_annotations[room_code][pdf_id].append(annotation_data)

    # Broadcast to all users in the room
    emit('annotation_added', {
        'pdf_id': pdf_id,
        'annotation': annotation_data
    }, room=room_code)

@socketio.on('update_annotation')
def on_update_annotation(data):
    """Handle updating existing annotations"""
    room_code = data['room_code']
    pdf_id = data['pdf_id']
    annotation_id = data['annotation_id']
    updates = data['updates']
    username = data['username']

    if not is_valid_room_code(room_code):
        emit('error', {'message': 'Room not found'})
        return

    # Find and update annotation
    if (room_code in room_annotations and
        pdf_id in room_annotations[room_code]):

        for annotation in room_annotations[room_code][pdf_id]:
            if annotation['id'] == annotation_id:
                # Update allowed fields
                for key, value in updates.items():
                    if key in ['text', 'color', 'coordinates']:
                        annotation[key] = value
                annotation['modified_by'] = username
                annotation['modified_at'] = datetime.now().isoformat()

                # Broadcast update
                emit('annotation_updated', {
                    'pdf_id': pdf_id,
                    'annotation_id': annotation_id,
                    'annotation': annotation
                }, room=room_code)
                break

@socketio.on('delete_annotation')
def on_delete_annotation(data):
    """Handle deleting annotations"""
    room_code = data['room_code']
    pdf_id = data['pdf_id']
    annotation_id = data['annotation_id']

    if not is_valid_room_code(room_code):
        emit('error', {'message': 'Room not found'})
        return

    # Find and remove annotation
    if (room_code in room_annotations and
        pdf_id in room_annotations[room_code]):

        room_annotations[room_code][pdf_id] = [
            ann for ann in room_annotations[room_code][pdf_id]
            if ann['id'] != annotation_id
        ]

        # Broadcast deletion
        emit('annotation_deleted', {
            'pdf_id': pdf_id,
            'annotation_id': annotation_id
        }, room=room_code)

@socketio.on('send_message')
def on_send_message(data):
    """Handle chat messages"""
    room_code = data['room_code']
    message = data['message']
    username = data['username']

    if not is_valid_room_code(room_code):
        emit('error', {'message': 'Room not found'})
        return

    message_data = {
        'id': str(uuid.uuid4()),
        'username': username,
        'message': message,
        'timestamp': datetime.now().isoformat()
    }

    # Broadcast message to all users in the room
    emit('message_received', message_data, room=room_code)

if __name__ == '__main__':
    import socket

    # Try different ports if 5001 is busy
    ports_to_try = [5010, 5011, 5012, 5013, 5014]

    for port in ports_to_try:
        try:
            # Test if port is available
            test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_socket.bind(('localhost', port))
            test_socket.close()

            print(f"Starting StudyMate Collaborative Mode on port {port}")
            print(f"Open your browser and go to: http://localhost:{port}")
            print("Press Ctrl+C to stop the server")
            print("-" * 50)

            socketio.run(app, debug=False, host='0.0.0.0', port=port)
            break

        except OSError:
            print(f"Port {port} is busy, trying next port...")
            continue
    else:
        print("All ports are busy! Please close other applications and try again.")