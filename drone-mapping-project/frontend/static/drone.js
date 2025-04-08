const droneIcon = L.icon({
    iconUrl: "/static/images/uav-quadcopter.svg",
    iconSize: [30, 30], // Size of the icon
    iconAnchor: [15, 15] // Anchor point of the icon (centered)
});

let droneMarker = null;

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

    if (droneMarker) {
        droneMarker.setLatLng(position);
    } else {
        droneMarker = L.marker(position, { icon: droneIcon }).addTo(window.map);
    }
}

async function pollDronePosition(droneId, intervalMs = 2000) {
    const position = await getDronePosition(droneId);
    updateDroneMarker(position);

    // Continue polling
    setTimeout(() => pollDronePosition(droneId, intervalMs), intervalMs);
}

document.addEventListener("DOMContentLoaded", function () {
    if (window.map) {
        pollDronePosition("drone1");
    } else {
        // Wait until map is ready (failsafe if map loads after DOMContentLoaded)
        const checkMapReady = setInterval(() => {
            if (window.map) {
                clearInterval(checkMapReady);
                pollDronePosition("drone1");
            }
        }, 100);
    }
});