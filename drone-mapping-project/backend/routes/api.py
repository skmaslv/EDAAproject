import time
from flask import Blueprint, request, jsonify, current_app
import json
from redis_utils import get_redis
from polygon_utils import apply_convex_hull
api_routes = Blueprint('api_routes', __name__)

@api_routes.route('/api/save_area', methods=['POST'])
def save_area():
    data = request.get_json()
    if 'coordinates' not in data:
        return jsonify({"error": "Missing coordinates"}), 400

    redis_client = get_redis()
    redis_client.set('selected_area', json.dumps(data['coordinates']))
    return jsonify({"message": "Area saved successfully"})

@api_routes.route('/api/get_area', methods=['GET'])
def get_area():
    redis_client = get_redis()
    area_data = redis_client.get('selected_area')
    if area_data is None:
        return jsonify({"error": "No area data found"}), 404

    return jsonify({"coordinates": json.loads(area_data)})

@api_routes.route('/api/drone/<drone_id>', methods=['POST'])
def set_drone_position(drone_id):
    redis_client = get_redis()
    data = request.get_json()
    position = data.get("position")
    if not position or len(position) != 2:
        return jsonify({"error": "Invalid position format"}), 400
    redis_client.set(f"drone:{drone_id}:position", json.dumps(position))
    return jsonify({"status": "success"}), 200

@api_routes.route('/api/drone/<drone_id>', methods=['GET'])
def get_drone_position(drone_id):
    redis_client = get_redis()
    data = redis_client.get(f"drone:{drone_id}:position")
    if data is None:
        return jsonify({"error": "No position found"}), 404
    return jsonify({"position": json.loads(data)})

@api_routes.route('/api/polygons', methods=['POST'])
def handle_polygon():
    data = request.get_json()
    redis_client = get_redis()
    try:
        # Validate input
        if 'coordinates' not in data or len(data['coordinates']) < 3:
            return jsonify({"error": len(data['coordinates'])}), 400
        
        # Apply convex hull algorithm
        hull_points = apply_convex_hull(data['coordinates'])
        
        # Ensure polygon is closed (first and last point should be same)
        if hull_points[0] != hull_points[-1]:
            hull_points.append(hull_points[0])
        
        # Delete all existing polygon keys
        for key in redis_client.scan_iter("polygon:*"):
            redis_client.delete(key)
        
        # Save the convex hull points
        polygon_id = f"polygon:{int(time.time())}"
        redis_client.set(polygon_id, json.dumps(hull_points))
        redis_client.publish("polygon_updates", polygon_id)
        
        return jsonify({
            "status": "success",
            "message": "Convex hull saved",
            "point_count": len(hull_points),
            "polygon_id": polygon_id
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_routes.route('/api/polygons', methods=['GET'])
def get_polygons():
    redis_client = get_redis()
    try:
        keys = redis_client.keys('polygon:*')
        polygons = []

        for key in keys:
            data = redis_client.get(key)
            if data:
                polygon = json.loads(data)
                polygons.append(polygon)

        return jsonify({'polygons': polygons}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
@api_routes.route('/api/polygons', methods=['DELETE'])
def delete_polygon():
    redis_client = get_redis()

    # Delete all keys matching "polygon:*"
    for key in redis_client.scan_iter("polygon:*"):
        redis_client.delete(key)

    redis_client.publish("polygon_updates", "deleted")
    return jsonify({"message": "Polygon(s) deleted successfully."}), 200