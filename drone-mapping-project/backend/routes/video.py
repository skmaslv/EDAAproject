from flask_socketio import SocketIO
import cv2
import base64

socketio = SocketIO(cors_allowed_origins='*')
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
            continue
        frame_data = encode_frame(frame)
        socketio.emit('video_frame', {'image': frame_data})
        socketio.sleep(0.03)

def register_video_handlers():
    @socketio.on('start_stream')
    def start_stream():
        global streaming
        if not streaming:
            streaming = True
            socketio.start_background_task(stream_frames)

    @socketio.on('stop_stream')
    def stop_stream():
        global streaming
        streaming = False
