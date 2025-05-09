from flask import Flask, render_template
from flask_cors import CORS
from routes.video import socketio, register_video_handlers
from routes import register_routes
from drones import start_drone_simulation

app = Flask(__name__, template_folder="../frontend", static_folder="../frontend/static")
CORS(app)
register_routes(app)
register_video_handlers()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/live_feed')
def live_feed():
    return render_template('live_feed.html')

if __name__ == '__main__':
    start_position = (55.705, 13.188)
    start_drone_simulation("drone1", start_position)
    start_drone_simulation("drone2", (55.68,13.2))
    # Then start the web app
    socketio.init_app(app)  # Attach to app
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
