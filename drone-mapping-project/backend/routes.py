from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import redis
import json
import time
from config import Config

routes = Blueprint('routes', __name__)
redis_client = Config.init_redis()

def apply_convex_hull(points):
    """Simple convex hull implementation for the backend"""
    if len(points) <= 1:
        return points
    
    # Sort the points by x-coordinate
    points = sorted(points, key=lambda p: (p[0], p[1]))
    
    # Build lower hull
    lower = []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    
    # Build upper hull
    upper = []
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    
    return lower[:-1] + upper[:-1]

def cross(o, a, b):
    return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])

@routes.route('/api/polygons', methods=['POST'])
@cross_origin()
def handle_polygon():
    data = request.get_json()
    try:
        # Validate input
        if 'coordinates' not in data or len(data['coordinates']) < 3:
            return jsonify({"error": "At least 3 points required"}), 400
        
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