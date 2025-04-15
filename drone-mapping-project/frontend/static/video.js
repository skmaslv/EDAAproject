const socket = io();
const video = document.getElementById('video');

// Auto-start the stream when page loads
document.addEventListener('DOMContentLoaded', () => {
    startStream();
});

// Listen for video frames
socket.on('video_frame', (data) => {
    video.src = 'data:image/jpeg;base64,' + data.image;
});

function startStream() {
    socket.emit('start_stream');
    document.querySelector('.stream-button').disabled = true;
    document.querySelector('.stop-button').disabled = false;
}

function stopStream() {
    socket.emit('stop_stream');
    document.querySelector('.stream-button').disabled = false;
    document.querySelector('.stop-button').disabled = true;
}