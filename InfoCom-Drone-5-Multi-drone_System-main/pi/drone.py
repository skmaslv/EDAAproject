from flask import Flask, request
from flask_cors import CORS
import subprocess
import  requests


app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = 'dljsaklqk24e21cjn!Ew@@dsa5'


#Give a unique ID for the drone
#===================================================================
myID = "DRONE_1"
#===================================================================

# Get initial longitude and latitude the drone
#===================================================================
current_longitude = 13.19398
current_latitude = 55.70405
#===================================================================

drone_info = {'id': myID,
                'longitude': current_longitude,
                'latitude': current_latitude,
                'status': 'idle'
            }

# Fill in the IP address of server, and send the initial location of the drone to the SERVER
#===================================================================
SERVER="http://192.168.1.101:5001/drone"
with requests.Session() as session:
    resp = session.post(SERVER, json=drone_info)
#===================================================================

@app.route('/', methods=['POST'])
def main():
    coords = request.json
    # Get current longitude and latitude of the drone 
    #===================================================================
    with open('/home/trissan/InfoCom-Drone-5-Multi-drone_System-main/pi/stored_local_cords.txt', 'r') as file:
        text = file.read()
        split_cords = text.split(',')
        current_longitude = split_cords[0]
        current_latitude = split_cords[1]
    #current_coords = coords['current']
    #current_longitude = current_coords[0]
    #current_latitude = current_coords[1]
    #===================================================================
    from_coord = coords['from']
    to_coord = coords['to']
    subprocess.Popen(["python3", "simulator.py", '--clong', str(current_longitude), '--clat', str(current_latitude),
                                                 '--flong', str(from_coord[0]), '--flat', str(from_coord[1]),
                                                 '--tlong', str(to_coord[0]), '--tlat', str(to_coord[1]),
                                                 '--id', myID
                    ])
    return 'New route received'

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
