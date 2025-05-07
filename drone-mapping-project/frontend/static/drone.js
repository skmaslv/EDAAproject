//drone.js
const droneIcon = L.icon({
    iconUrl: "/static/images/uav-quadcopter.svg",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

let droneMarker = null;
let currentLatLng = null;
let targetLatLng = null;
let animationFrameId = null;

async function getDronePosition(droneId) {
    try {
        const response = await fetch(`http://localhost:5000/api/drone/${droneId}`);
        if (!response.ok) {
            console.error("Failed to fetch drone position:", await response.json());
            return null;
        }
        const data = await response.json();
        return data.position; // [lat, lng]
    } catch (error) {
        console.error("Error fetching drone position:", error);
        return null;
    }
}

function updateDroneMarker(position) {
    if (!position) return;

    const latLng = L.latLng(position[0], position[1]);

    if (!droneMarker) {
        droneMarker = L.marker(latLng, { icon: droneIcon }).addTo(window.map);
        currentLatLng = latLng;
    }

    targetLatLng = latLng;
}

function animateDrone() {
    if (!currentLatLng || !targetLatLng) {
        animationFrameId = requestAnimationFrame(animateDrone);
        return;
    }

    const step = 0.05; // Adjust for smoothness (lower = smoother/slower)

    const lat = currentLatLng.lat + (targetLatLng.lat - currentLatLng.lat) * step;
    const lng = currentLatLng.lng + (targetLatLng.lng - currentLatLng.lng) * step;

    currentLatLng = L.latLng(lat, lng);
    droneMarker.setLatLng(currentLatLng);

    animationFrameId = requestAnimationFrame(animateDrone);
}

async function pollDronePosition(droneId, intervalMs = 1000) {
    const position = await getDronePosition(droneId);
    updateDroneMarker(position);

    setTimeout(() => pollDronePosition(droneId, intervalMs), intervalMs);
}

document.addEventListener("DOMContentLoaded", function () {
    const start = () => {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(animateDrone);
        }
        pollDronePosition("drone1");
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