from flask_socketio import SocketIO
import cv2
import base64
import threading
from threading import Lock


socketio = SocketIO(cors_allowed_origins='*')

streaming = False

def stream_video():
    global streaming
    video_source = 'http://admin:admin@192.168.137.73:8080/video'
    cap = None

    while streaming:
        try:
            # Open stream if not opened or lost
            if cap is None or not cap.isOpened():
                print("🔄 Attempting to connect to stream...")
                cap = cv2.VideoCapture(video_source)
                if not cap.isOpened():
                    print("❌ Failed to connect. Retrying in 5 seconds.")
                    socketio.sleep(5)
                    continue
                else:
                    print("✅ Connected to stream.")

            # Read frame
            ret, frame = cap.read()
            if not ret or frame is None:
                print("⚠️ Lost frame. Releasing and retrying...")
                cap.release()
                cap = None
                socketio.sleep(2)
                continue

            # Encode and emit
            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                print("⚠️ JPEG encoding failed")
                continue

            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            socketio.emit('video_frame', {'image': jpg_as_text})
            socketio.sleep(0.03)  # ~10 FPS

        except Exception as e:
            print("❌ Exception in stream loop:", e)
            socketio.sleep(2)
    cap.release


def register_video_handlers():
    @socketio.on('start_stream')
    def start_stream():
        global streaming
        if not streaming:
            streaming = True
            socketio.start_background_task(stream_video)

    @socketio.on('stop_stream')
    def stop_stream():
        global streaming
        streaming = False
