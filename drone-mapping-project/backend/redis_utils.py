import redis
import json
import time
from config import REDIS_CONFIG

def get_redis():
    """Simple Redis connection helper"""
    return redis.Redis(**REDIS_CONFIG)

def save_polygon(coords):
    r = get_redis()
    polygon_id = f"polygon:{int(time.time())}"
    r.set(polygon_id, json.dumps(coords))
    return polygon_id
