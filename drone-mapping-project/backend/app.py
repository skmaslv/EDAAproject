from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import redis
import json
import os

from flask import Flask
from flask_cors import CORS
from config import Config
from routes import routes

app = Flask(__name__,  template_folder="../frontend", static_folder="../frontend/static")
#app.config.from_object(Config)
CORS(app)

redis_client = Config.init_redis()

app.register_blueprint(routes)

@app.route('/')
def index():
    """Render the index.html file."""
    return render_template('index.html')

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