// Study room JavaScript functionality
let socket;
let username = '';
let currentPdf = null;
let isHighlightMode = false;
let currentAnnotation = null;
let screenStream = null;
let isScreenSharing = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if username is stored
    username = sessionStorage.getItem('username');
    
    if (!username) {
        // Show username modal
        const usernameModal = new bootstrap.Modal(document.getElementById('usernameModal'));
        usernameModal.show();
    } else {
        initializeRoom();
    }
    
    setupEventListeners();
});

function initializeRoom() {
    // Initialize Socket.IO connection
    socket = io();
    
    // Socket event listeners
    socket.on('connect', function() {
        console.log('Connected to server');
        joinStudyRoom();
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        showNotification('Connection lost. Trying to reconnect...', 'warning');
    });
    
    socket.on('room_joined', function(data) {
        console.log('Joined room:', data);
        updateUserCount(data.user_count);
        loadRoomPdfs(data.pdfs);
        loadRoomAnnotations(data.annotations);

        // Update current user name
        document.getElementById('currentUserName').textContent = username;

        // Add welcome message to chat
        addChatMessage('system', `Welcome to room ${data.room_code}! You can now upload PDFs and start studying together.`);
        showNotification(`Welcome to room ${data.room_code}!`, 'success');
    });
    
    socket.on('user_joined', function(data) {
        console.log('User joined:', data);
        updateUserCount(data.user_count);
        addChatMessage('system', `${data.username} joined the room`);
        updateParticipantsList();
    });
    
    socket.on('user_left', function(data) {
        console.log('User left:', data);
        updateUserCount(data.user_count);
        addChatMessage('system', `${data.username} left the room`);
        updateParticipantsList();
    });
    
    socket.on('pdf_uploaded', function(data) {
        console.log('PDF uploaded:', data);
        loadPdf(data);
        addChatMessage('system', `${data.uploaded_by} shared "${data.original_name}" - Now everyone can study together!`);
    });
    
    socket.on('annotation_added', function(data) {
        console.log('Annotation added:', data);
        if (currentPdf && currentPdf.id === data.pdf_id) {
            renderAnnotation(data.annotation);
        }
    });
    
    socket.on('annotation_updated', function(data) {
        console.log('Annotation updated:', data);
        if (currentPdf && currentPdf.id === data.pdf_id) {
            updateAnnotationDisplay(data.annotation);
        }
    });
    
    socket.on('annotation_deleted', function(data) {
        console.log('Annotation deleted:', data);
        if (currentPdf && currentPdf.id === data.pdf_id) {
            removeAnnotationDisplay(data.annotation_id);
        }
    });
    
    socket.on('message_received', function(data) {
        console.log('Message received:', data);
        addChatMessage('other', data.message, data.username, data.timestamp);
    });
    
    socket.on('error', function(data) {
        console.error('Socket error:', data);
        showNotification(data.message, 'error');
    });
}

function setupEventListeners() {
    // PDF upload handler
    document.getElementById('pdfUpload').addEventListener('change', handlePdfUpload);
    
    // Chat input handler
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // PDF viewer click handler for annotations
    document.getElementById('pdfViewer').addEventListener('click', handlePdfClick);
    
    // Annotation modal handlers
    document.getElementById('annotationModal').addEventListener('hidden.bs.modal', function() {
        currentAnnotation = null;
    });
}

function joinRoom() {
    const usernameInput = document.getElementById('usernameInput').value.trim();
    if (!usernameInput) {
        showNotification('Please enter your name', 'error');
        return;
    }
    
    username = usernameInput;
    sessionStorage.setItem('username', username);
    
    // Hide modal and initialize room
    const usernameModal = bootstrap.Modal.getInstance(document.getElementById('usernameModal'));
    usernameModal.hide();
    
    initializeRoom();
}

function joinStudyRoom() {
    socket.emit('join_study_room', {
        room_code: ROOM_CODE,
        username: username
    });
}

function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        showNotification('Please select a PDF file', 'error');
        return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
        showNotification('File size must be less than 50MB', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('room_code', ROOM_CODE);
    formData.append('username', username);
    
    // Show upload progress
    showNotification('Uploading PDF...', 'info');
    
    fetch('/api/upload_pdf', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('PDF uploaded successfully!', 'success');
            // The PDF will be added to the list via socket event
        } else {
            showNotification(data.message || 'Upload failed', 'error');
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
        showNotification('Upload failed. Please try again.', 'error');
    })
    .finally(() => {
        // Reset file input
        event.target.value = '';
    });
}

// Chat functionality
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Add message to own chat immediately
    addChatMessage('own', message, username);
    
    // Send to server
    socket.emit('send_message', {
        room_code: ROOM_CODE,
        message: message,
        username: username
    });
    
    // Clear input
    messageInput.value = '';
}

function addChatMessage(type, message, senderUsername = '', timestamp = null) {
    const chatMessages = document.getElementById('chatMessages');

    // Remove welcome message if it exists
    const welcomeMsg = chatMessages.querySelector('.text-center');
    if (welcomeMsg && welcomeMsg.querySelector('i.fas.fa-comments')) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');

    if (type === 'system') {
        messageDiv.className = 'chat-message system text-center';
        messageDiv.innerHTML = `
            <div class="alert alert-info py-2 px-3 small">
                <i class="fas fa-info-circle me-1"></i>${escapeHtml(message)}
            </div>
        `;
    } else {
        messageDiv.className = `chat-message ${type}`;

        const timeStr = timestamp ?
            new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) :
            new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        if (type === 'own') {
            messageDiv.innerHTML = `
                <div class="d-flex justify-content-end mb-1">
                    <div class="message-content p-2" style="background-color: #007bff; color: white; max-width: 280px; border-radius: 18px 18px 5px 18px;">
                        <div>${escapeHtml(message)}</div>
                        <div class="small opacity-75 mt-1 text-end">${timeStr}</div>
                    </div>
                </div>
            `;
        } else {
            // Generate a consistent color for each user
            const userColor = getUserColor(senderUsername);

            messageDiv.innerHTML = `
                <div class="d-flex justify-content-start mb-1">
                    <div style="max-width: 280px;">
                        <div class="small fw-bold mb-1" style="color: ${userColor}; margin-left: 12px;">${escapeHtml(senderUsername)}</div>
                        <div class="message-content p-2" style="background-color: white; color: #333; border-radius: 18px 18px 18px 5px;">
                            <div>${escapeHtml(message)}</div>
                            <div class="small text-muted mt-1">${timeStr}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    chatMessages.appendChild(messageDiv);

    // Smooth scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

// Generate consistent colors for users
function getUserColor(username) {
    const colors = [
        '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
        '#2196f3', '#00bcd4', '#009688', '#4caf50',
        '#ff9800', '#ff5722', '#795548', '#607d8b'
    ];

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

// PDF functionality
function loadRoomPdfs(pdfs) {
    if (pdfs.length > 0) {
        // Load the most recent PDF automatically
        const latestPdf = pdfs[pdfs.length - 1];
        loadPdf(latestPdf);
    }
}

// Simplified - no PDF list needed, just auto-load

function loadPdf(pdf) {
    currentPdf = pdf;

    // Update current PDF name in toolbar
    document.getElementById('currentPdfName').textContent = pdf.original_name;

    // Show remove PDF button
    document.getElementById('removePdfBtn').style.display = 'inline-block';

    // Load PDF using PDF.js
    const loadingTask = pdfjsLib.getDocument(pdf.url);
    loadingTask.promise.then(function(pdfDoc) {
        renderPdfPages(pdfDoc);
        showNotification(`Now studying: ${pdf.original_name}`, 'success');
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        showNotification('Failed to load PDF', 'error');
    });
}

function renderPdfPages(pdfDoc) {
    const pdfContainer = document.getElementById('pdfContainer');
    pdfContainer.innerHTML = '';
    pdfContainer.style.backgroundColor = 'transparent';
    pdfContainer.style.padding = '10px';

    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        pdfDoc.getPage(pageNum).then(function(page) {
            const scale = 1.3;
            const viewport = page.getViewport({ scale: scale });

            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';
            pageDiv.dataset.pageNumber = pageNum;
            pageDiv.style.cssText = `
                margin: 15px auto;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                background: white;
                position: relative;
                max-width: 95%;
                display: block;
                cursor: ${isHighlightMode ? 'crosshair' : 'default'};
            `;

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.cssText = `
                display: block;
                border-radius: 8px;
                max-width: 100%;
                height: auto;
            `;

            pageDiv.appendChild(canvas);
            pdfContainer.appendChild(pageDiv);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            page.render(renderContext);
        });
    }
}

// Utility functions
function updateUserCount(count) {
    document.getElementById('userCount').textContent = count;
    document.getElementById('userCount2').textContent = count;
}

function updateParticipantsList() {
    // This would be implemented with actual participant data
    // For now, just show the count
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; max-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function leaveRoom() {
    if (confirm('Are you sure you want to leave the study room?')) {
        window.location.href = '/';
    }
}

// Simple highlighting functionality
function toggleHighlight() {
    isHighlightMode = !isHighlightMode;
    const btn = document.getElementById('highlightBtn');

    if (isHighlightMode) {
        btn.style.backgroundColor = '#28a745';
        btn.style.borderColor = '#28a745';
        btn.innerHTML = '<i class="fas fa-highlighter me-2"></i>Highlighting ON';
        showNotification('Highlight mode ON - Click on PDF to highlight text', 'success');

        // Update cursor for all PDF pages
        document.querySelectorAll('.pdf-page').forEach(page => {
            page.style.cursor = 'crosshair';
        });
    } else {
        btn.style.backgroundColor = '#ffc107';
        btn.style.borderColor = '#ffc107';
        btn.innerHTML = '<i class="fas fa-highlighter me-2"></i>Highlight';
        showNotification('Highlight mode OFF', 'info');

        // Reset cursor for all PDF pages
        document.querySelectorAll('.pdf-page').forEach(page => {
            page.style.cursor = 'default';
        });
    }
}

function handlePdfClick(event) {
    if (!currentPdf || !isHighlightMode) return;

    const pdfPage = event.target.closest('.pdf-page');
    if (!pdfPage) return;

    const rect = pdfPage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pageNumber = parseInt(pdfPage.dataset.pageNumber);

    createHighlight(x, y, pageNumber, pdfPage);
}

function createHighlight(x, y, pageNumber, pdfPage) {
    const annotation = {
        type: 'highlight',
        page: pageNumber,
        coordinates: { x: x - 80, y: y - 20, width: 160, height: 40 },
        color: '#ffff00'
    };

    socket.emit('add_annotation', {
        room_code: ROOM_CODE,
        pdf_id: currentPdf.id,
        annotation: annotation,
        username: username
    });

    // Show feedback
    showNotification(`Highlight added by ${username}! Everyone can see it.`, 'success');
}

// Simplified - no notes, just highlighting

function renderAnnotation(annotation) {
    const pdfPage = document.querySelector(`[data-page-number="${annotation.page}"]`);
    if (!pdfPage) return;

    const annotationEl = document.createElement('div');
    annotationEl.className = `annotation highlight`;
    annotationEl.dataset.annotationId = annotation.id;
    annotationEl.style.cssText = `
        position: absolute;
        left: ${annotation.coordinates.x}px;
        top: ${annotation.coordinates.y}px;
        width: ${annotation.coordinates.width}px;
        height: ${annotation.coordinates.height}px;
        background-color: rgba(255, 255, 0, 0.6);
        border: 2px solid rgba(255, 193, 7, 0.9);
        border-radius: 6px;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
        z-index: 10;
    `;

    // Add tooltip showing who created the highlight
    annotationEl.title = `Highlighted by ${annotation.created_by}`;

    pdfPage.appendChild(annotationEl);

    // Show notification when friend's highlight appears
    if (annotation.created_by !== username) {
        showNotification(`${annotation.created_by} added a highlight`, 'info');
    }
}

function loadRoomAnnotations(annotations) {
    if (!annotations || !currentPdf) return;

    const pdfAnnotations = annotations[currentPdf.id];
    if (pdfAnnotations) {
        pdfAnnotations.forEach(annotation => {
            renderAnnotation(annotation);
        });
    }
}

// Simplified - no screen sharing needed for basic study mode

// Room sharing functionality
function shareRoom() {
    const shareModal = new bootstrap.Modal(document.getElementById('shareRoomModal'));
    shareModal.show();
}

function copyRoomCodeShare() {
    const roomCode = ROOM_CODE;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(roomCode).then(() => {
            showNotification('Room code copied! Share it with your friends.', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }
}

// Remove PDF function
function removePdf() {
    if (!currentPdf) return;

    if (confirm(`Remove "${currentPdf.original_name}" from the study session?`)) {
        // Clear the PDF viewer
        const pdfContainer = document.getElementById('pdfContainer');
        pdfContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><i class="fas fa-file-pdf" style="font-size: 60px; margin-bottom: 20px;"></i><h4>PDF Removed</h4><p>Upload a new PDF to continue studying</p></div>';

        // Reset current PDF
        currentPdf = null;

        // Update toolbar
        document.getElementById('currentPdfName').textContent = 'No PDF loaded';
        document.getElementById('removePdfBtn').style.display = 'none';

        // Turn off highlight mode
        if (isHighlightMode) {
            toggleHighlight();
        }

        // Notify others
        socket.emit('send_message', {
            room_code: ROOM_CODE,
            message: `${username} removed the PDF from the study session`,
            username: username
        });

        showNotification('PDF removed from study session', 'info');
    }
}

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
