from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO
import json
import cv2
import base64
from config import Config
from routes import routes

app = Flask(__name__, template_folder="../frontend", static_folder="../frontend/static")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins='*')  # Add Socket.IO

redis_client = Config.init_redis()
app.register_blueprint(routes)

# Video streaming variables
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

# Socket.IO events
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
@app.route('/')
def index():
    """Render the index.html file."""
    return render_template('index.html')

@app.route('/live_feed')
def live_feed():
    """Render the live_feed.html file."""
    return render_template('live_feed.html')

@app.route('/api/save_area', methods=['POST'])
def save_area():
    """Save the selected area coordinates to Redis."""
    data = request.get_json()
    if 'coordinates' not in data:
        return jsonify({"error": "Missing coordinates"}), 400
    
    redis_client.set('selected_area', json.dumps(data['coordinates']))
    return jsonify({"message": "Area saved successfully"})

@app.route('/api/get_area', methods=['GET'])
def get_area():
    """Retrieve the stored area coordinates from Redis."""
    area_data = redis_client.get('selected_area')
    if area_data is None:
        return jsonify({"error": "No area data found"}), 404
    
    return jsonify({"coordinates": json.loads(area_data)})

@app.route('/api/drone/<drone_id>', methods=['POST'])
def set_drone_position(drone_id):
    data = request.get_json()
    lat, lng = data.get('lat'), data.get('lng')
    if lat is None or lng is None:
        return jsonify({"error": "Missing lat or lng"}), 400

    redis_client.set(f"drone:{drone_id}:position", json.dumps([lat, lng]))
    return jsonify({"message": "Position updated"})

@app.route('/api/drone/<drone_id>', methods=['GET'])
def get_drone_position(drone_id):
    data = redis_client.get(f"drone:{drone_id}:position")
    if data is None:
        return jsonify({"error": "No position found"}), 404
    return jsonify({"position": json.loads(data)})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port='5000')