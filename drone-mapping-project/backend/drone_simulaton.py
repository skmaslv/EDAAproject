import redis
import json

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
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    pubsub = redis_client.pubsub()
    pubsub.subscribe("polygon_updates")


    for message in pubsub.listen():
        if message['type'] == 'message':
            polygon_key = message['data']
            polygon_data = redis_client.get(polygon_key)
            if not polygon_data:
                continue

            polygon = json.loads(polygon_data)

            # Example test point
            test_point = (55.705, 13.188)
            inside = winding_number(test_point, polygon)
            print(f"Test point {test_point} inside polygon? {inside}")

if __name__ == '__main__':
    listen_for_polygon_updates()
