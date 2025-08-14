// Main page JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    const createRoomForm = document.getElementById('createRoomForm');
    const joinRoomForm = document.getElementById('joinRoomForm');
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    const errorAlert = document.getElementById('errorAlert');
    
    let currentRoomCode = '';

    // Create room form handler
    createRoomForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('createUsername').value.trim();
        if (!username) {
            showError('Please enter your name');
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="loading"></span> Creating...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/create_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username })
            });

            const data = await response.json();

            if (data.success) {
                currentRoomCode = data.room_code;
                document.getElementById('roomCodeDisplay').textContent = data.room_code;
                successModal.show();
                
                // Store username for room entry
                sessionStorage.setItem('username', username);
            } else {
                showError(data.message || 'Failed to create room');
            }
        } catch (error) {
            console.error('Error creating room:', error);
            showError('Network error. Please try again.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Join room form handler
    joinRoomForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('joinUsername').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
        
        if (!username) {
            showError('Please enter your name');
            return;
        }
        
        if (!roomCode) {
            showError('Please enter a room code');
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="loading"></span> Joining...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/join_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    username: username,
                    room_code: roomCode 
                })
            });

            const data = await response.json();

            if (data.success) {
                // Store username for room entry
                sessionStorage.setItem('username', username);
                // Redirect to room
                window.location.href = `/room/${roomCode}`;
            } else {
                showError(data.message || 'Failed to join room');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            showError('Network error. Please try again.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Enter room button handler
    document.getElementById('enterRoomBtn').addEventListener('click', function() {
        if (currentRoomCode) {
            window.location.href = `/room/${currentRoomCode}`;
        }
    });

    // Auto-uppercase room code input
    document.getElementById('roomCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });

    // Enter key handlers
    document.getElementById('createUsername').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createRoomForm.dispatchEvent(new Event('submit'));
        }
    });

    document.getElementById('roomCode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinRoomForm.dispatchEvent(new Event('submit'));
        }
    });
});

// Utility functions
function showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorAlert.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorAlert.classList.remove('show');
    }, 5000);
}

function copyRoomCode() {
    const roomCode = document.getElementById('roomCodeDisplay').textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(roomCode).then(() => {
            // Show success feedback
            const btn = event.target.closest('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check me-2"></i>Copied!';
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-success');
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-secondary');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(roomCode);
        });
    } else {
        fallbackCopyTextToClipboard(roomCode);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showSuccess('Room code copied to clipboard!');
        } else {
            showError('Failed to copy room code');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showError('Failed to copy room code');
    }
    
    document.body.removeChild(textArea);
}

function showSuccess(message) {
    // Create a temporary success alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 end-0 m-3';
    alertDiv.style.zIndex = '1050';
    alertDiv.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 3000);
}

// Form validation styling
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('is-invalid') && this.value.trim() !== '') {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    });
});
