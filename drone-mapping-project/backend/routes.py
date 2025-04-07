from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import redis
import json
import time

routes = Blueprint('routes', __name__)
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=False)

@routes.route('/api/polygons', methods=['POST'])
@cross_origin()
def handle_polygon():
    data = request.get_json()
    try:
        # Delete all existing polygon keys
        for key in redis_client.scan_iter("polygon:*"):
            redis_client.delete(key)
        
        # Save new polygon
        coordinates = data['coordinates']
        polygon_id = f"polygon:{int(time.time())}"
        redis_client.set(polygon_id, json.dumps(coordinates))
        
        return jsonify({
            "status": "success",
            "polygon_id": polygon_id,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
