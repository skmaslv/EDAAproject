#drone_simulation.py
import time
import redis
import json
from flask import request
from config import Config
import random
import threading
from redis_utils import set_drone_position, get_drone_position


redis_client = Config.init_redis()
current_polygon = None
interval = 0.1  # faster movement
step_size = 0.002  # slightly larger step



def is_left(p0, p1, p2):
    """Determines if p2 is to the left of the line formed by p0 and p1."""
    return (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])

def winding_number(point, polygon):
    """Calculates the winding number for a point relative to a polygon."""
    wn = 0  # Winding number counter
    x, y = point
    
    for i in range(len(polygon)):
        p1 = polygon[i]
        p2 = polygon[(i + 1)% len(polygon)]  # Wrap around to the first vertex
        
        if p1[1] <= y < p2[1]:  # Edge crosses upward
            if is_left(p1, p2, point) > 0:
                wn += 1
        elif p2[1] <= y < p1[1]:  # Edge crosses downward
            if is_left(p1, p2, point) < 0:
                wn -= 1
    
    return wn != 0  # Non-zero winding means inside

def listen_for_polygon_updates():
    global current_polygon
    pubsub = redis_client.pubsub()
    pubsub.subscribe("polygon_updates")

    try:
        while True:
            message = pubsub.get_message()
            if message and message['type'] == 'message':
                polygon_key = message['data']
                polygon_data = redis_client.get(polygon_key)
                if not polygon_data:
                    continue

                polygon = json.loads(polygon_data)
                current_polygon = polygon
                print(f"Received new polygon: {current_polygon}")
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("Stopped listening for polygon updates.")




def fly_in_polygon(drone_id, start_position, polygon):
    """
    Makes the drone fly around within a polygon.

    Args:
        drone_id (str): The ID of the drone.
        start_position (tuple): The starting position of the drone (lat, lng).
        polygon (list): A list of (lat, lng) tuples defining the polygon.
        interval (int): Time interval (in seconds) between position updates.
    """
    global current_polygon
    current_position = start_position
    set_drone_position(drone_id, *current_position)  # Set initial position

    try:
        while True:
            if current_polygon is None:
                time.sleep(interval)
                continue
            if current_polygon != polygon:
                fly_to_polygon(drone_id, current_position, current_polygon)
                return
            # Generate a random movement (small step)
            lat_offset = random.uniform(-step_size, step_size)  # Small latitude change
            lng_offset = random.uniform(-step_size, step_size)  # Small longitude change
            new_position = (current_position[0] + lat_offset, current_position[1] + lng_offset)

            # Check if the new position is inside the polygon
            if winding_number(new_position, polygon):
                # Update the drone's position
                current_position = new_position
                set_drone_position(drone_id, *current_position)

            # Wait for the next update
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"Drone {drone_id} stopped flying.")

def fly_to_polygon(drone_id, start_position, polygon):
    """
    Moves the drone from a start position to the nearest point inside the polygon.

    Args:
        drone_id (str): The ID of the drone.
        start_position (tuple): The starting position of the drone (lat, lng).
        polygon (list): A list of (lat, lng) tuples defining the polygon.
        step_size (float): The size of each movement step.
        interval (float): Time interval (in seconds) between position updates.
    """
    global current_polygon
    current_polygon = polygon
    current_position = start_position
    set_drone_position(drone_id, *current_position)  # Set initial position

    # Calculate the centroid of the polygon as the target point
    target_lat = sum(point[0] for point in polygon) / len(polygon)
    target_lng = sum(point[1] for point in polygon) / len(polygon)
    target_position = (target_lat, target_lng)
    print(f"Target position (centroid of polygon): {target_position}")

    try:
        while not winding_number(current_position, polygon):
            if current_polygon is None:
                time.sleep(interval)
                continue
            if current_polygon != polygon:
                fly_to_polygon(drone_id, current_position, current_polygon)
                return
            # Calculate the direction vector toward the target
            direction_lat = target_position[0] - current_position[0]
            direction_lng = target_position[1] - current_position[1]

            # Normalize the direction vector
            magnitude = (direction_lat**2 + direction_lng**2)**0.5
            unit_lat = direction_lat / magnitude
            unit_lng = direction_lng / magnitude

            # Move the drone a step closer to the target
            new_position = (
                current_position[0] + unit_lat * step_size,
                current_position[1] + unit_lng * step_size
            )

            # Update the drone's position
            current_position = new_position
            set_drone_position(drone_id, *current_position)

            # Wait for the next update
            time.sleep(interval)
        fly_in_polygon(drone_id, current_position, polygon)
         # Once inside the polygon, start flying randomly within it  
        print(f"Drone {drone_id} has entered the polygon at {current_position}")
    except KeyboardInterrupt:
        print(f"Drone {drone_id} stopped flying to the polygon.")

def start_drone_simulation(drone_id="drone1", start_pos=(55.705, 13.188)):
    # Start listener thread
    listener_thread = threading.Thread(target=listen_for_polygon_updates, daemon=True)
    listener_thread.start()

    # Start drone flying logic in its own thread too
    def drone_worker():
        try:
            fly_in_polygon(drone_id, start_pos, current_polygon or [])
        except KeyboardInterrupt:
            print("Drone simulation interrupted.")

    drone_thread = threading.Thread(target=drone_worker, daemon=True)
    drone_thread.start()
