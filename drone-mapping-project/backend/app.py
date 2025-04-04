from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import redis
import json

# Initialize Flask app
app = Flask(__name__, template_folder="../frontend", static_folder="../frontend/static")
CORS(app)

# Initialize Redis client
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

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

# Import and register routes AFTER app creation
from routes import routes
app.register_blueprint(routes)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port='5000')
