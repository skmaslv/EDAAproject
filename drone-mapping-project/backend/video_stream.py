from flask import Flask, send_file
from flask_socketio import SocketIO
import cv2
import base64
import threading
import time
import os

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

camera = cv2.VideoCapture(0)
streaming = False

def encode_frame(frame):
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

def stream_frames():
    global streaming
    while streaming:
        success, frame = camera.read()
        if not success:
            print("Failed to capture frame")
            continue
        frame_data = encode_frame(frame)
        socketio.emit('video_frame', {'image': frame_data})
        socketio.sleep(0.03)  # ~30 FPS
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.route('/')
def serve_frontend():
    html_path = os.path.join(BASE_DIR, 'frontend', 'live_feed.html')
    return send_file(html_path)

@socketio.on('start_stream')
def start_stream():
    global streaming
    if not streaming:
        streaming = True
        socketio.start_background_task(target=stream_frames)
        

@socketio.on('stop_stream')
def stop_stream():
    global streaming
    streaming = False

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port='5001' )
