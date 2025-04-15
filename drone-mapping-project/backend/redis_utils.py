import json
import redis
from config import Config

def get_redis():
    return Config.init_redis()

def set_drone_position(drone_id, lat, lng):
    redis_client = get_redis()
    redis_client.set(f"drone:{drone_id}:position", json.dumps([lat, lng]))

def get_drone_position(drone_id):
    redis_client = get_redis()
    data = redis_client.get(f"drone:{drone_id}:position")
    if data:
        position = json.loads(data)
        print(f"Drone {drone_id} position:", position)
        return position
    else:
        print(f"No position found for drone {drone_id}")
        return None
