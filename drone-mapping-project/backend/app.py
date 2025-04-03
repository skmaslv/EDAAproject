from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
import json

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Initialize Redis client
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

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

if __name__ == '__main__':
    app.run(debug=True)

