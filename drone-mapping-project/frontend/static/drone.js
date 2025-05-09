const droneIcon = L.icon({
    iconUrl: "/static/images/uav-quadcopter.svg",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

let drones = {
    drone1: {
        marker: null,
        currentLatLng: null,
        targetLatLng: null,
        animationFrameId: null
    },
    drone2: {
        marker: null,
        currentLatLng: null,
        targetLatLng: null,
        animationFrameId: null
    }
};

async function getDronePosition(droneId) {
    try {
        const response = await fetch(`http://localhost:5000/api/drone/${droneId}`);
        if (!response.ok) {
            console.error("Failed to fetch drone position:", await response.json());
            return null;
        }
        const data = await response.json();
        console.log("Good fetch");
        return data.position; // [lat, lng]
    } catch (error) {
        console.error(`Error fetching ${droneId}'s position:`, error);
        return null;
    }
}

function updateDroneMarker(droneId, position) {
    if (!position) return;

    const latLng = L.latLng(position[0], position[1]);
    const drone = drones[droneId];

    if (!drone.marker) {
        // Create a new marker if it doesn't exist
        drone.marker = L.marker(latLng, { icon: droneIcon }).addTo(window.map);
        drone.currentLatLng = latLng;
    }

    // Update the target position
    drone.targetLatLng = latLng;
}

function animateDrone(droneId) {
    const drone = drones[droneId];

    if (!drone.currentLatLng || !drone.targetLatLng) {
        drone.animationFrameId = requestAnimationFrame(() => animateDrone(droneId));
        return;
    }

    const step = 0.05; // Adjust for smoothness (lower = smoother/slower)

    const lat = drone.currentLatLng.lat + (drone.targetLatLng.lat - drone.currentLatLng.lat) * step;
    const lng = drone.currentLatLng.lng + (drone.targetLatLng.lng - drone.currentLatLng.lng) * step;

    drone.currentLatLng = L.latLng(lat, lng);
    drone.marker.setLatLng(drone.currentLatLng);

    drone.animationFrameId = requestAnimationFrame(() => animateDrone(droneId));
}

async function pollDronePosition(droneId, intervalMs = 1000) {
    const position = await getDronePosition(droneId);
    updateDroneMarker(droneId, position);

    setTimeout(() => pollDronePosition(droneId, intervalMs), intervalMs);
}

document.addEventListener("DOMContentLoaded", function () {
    const start = () => {
        if (!drones.drone1.animationFrameId) {
            drones.drone1.animationFrameId = requestAnimationFrame(() => animateDrone("drone1"));
        }
        if (!drones.drone2.animationFrameId) {
            drones.drone2.animationFrameId = requestAnimationFrame(() => animateDrone("drone2"));
        }

        pollDronePosition("drone1");
        pollDronePosition("drone2");
    };

    if (window.map) {
        start();
    } else {
        const checkMapReady = setInterval(() => {
            if (window.map) {
                clearInterval(checkMapReady);
                start();
            }
        }, 100);
    }
});