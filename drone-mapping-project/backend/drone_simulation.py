import time
import redis
import json
from flask import request
from config import Config

redis_client = Config.init_redis()

def set_drone_position(drone_id, lat, lng):
    redis_client.set(f"drone:{drone_id}:position", json.dumps([lat, lng]))
    print(f"Set drone {drone_id} to position {[lat, lng]}")

def get_drone_position(drone_id):
    data = redis_client.get(f"drone:{drone_id}:position")
    if data:
        position = json.loads(data)
        print(f"Drone {drone_id} position:", position)
        return position
    else:
        print(f"No position found for drone {drone_id}")
        return None


def is_left(p0, p1, p2):
    """Determines if p2 is to the left of the line formed by p0 and p1."""
    return (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])

def winding_number(point, polygon):
    """Calculates the winding number for a point relative to a polygon."""
    wn = 0  # Winding number counter
    x, y = point
    
    for i in range(len(polygon)):
        p1 = polygon[i]
        p2 = polygon[(i + 1) % len(polygon)]  # Wrap around to the first vertex
        
        if p1[1] <= y < p2[1]:  # Edge crosses upward
            if is_left(p1, p2, point) > 0:
                wn += 1
        elif p2[1] <= y < p1[1]:  # Edge crosses downward
            if is_left(p1, p2, point) < 0:
                wn -= 1
    
    return wn != 0  # Non-zero winding means inside

def listen_for_polygon_updates():
    pubsub = redis_client.pubsub()
    pubsub.subscribe("polygon_updates")
    print("Listening for polygon updates drone_simulation...")

    try:
        while True:
            message = pubsub.get_message()
            if message and message['type'] == 'message': # Decode bytes to str
                polygon_key = message['data']
                polygon_data = redis_client.get(polygon_key)
                if not polygon_data:
                    continue

                polygon = json.loads(polygon_data)

                # Example test point
                test_point = (55.705, 13.188)
                inside = winding_number(test_point, polygon)
                print(f"Test point {test_point} inside polygon? {inside}")
            time.sleep(0.1)  # Prevent CPU hogging
    except KeyboardInterrupt:
        print("Stopped listening for polygon updates.")

if __name__ == '__main__':
    set_drone_position("drone1", 55.705, 13.188)
    get_drone_position("drone1")
    listen_for_polygon_updates()
