const droneIcon = L.icon({
    iconUrl: "/static/images/uav-quadcopter.svg",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

let drones = {
    drone1: {
        id: "drone1",
        marker: null,
        currentLatLng: [55.705, 13.188],
        targetLatLng: null,
        animationFrameId: null
    },
    drone2: {
        id: "drone2",
        marker: null,
        currentLatLng: [55.708, 13.19],
        targetLatLng: null,
        animationFrameId: null
    }
};

//Moving drone logic to frontend.
function isLeft(p0, p1, p2) {
    return (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
}

function windingNumber(point, polygon) {
    let wn = 0;
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        if (p1[1] <= point[1]) {
            if (p2[1] > point[1] && isLeft(p1, p2, point) > 0) wn++;
        } else {
            if (p2[1] <= point[1] && isLeft(p1, p2, point) < 0) wn--;
        }
    }
    return wn !== 0;
}

function getRandomPointInPolygon(polygonLatLngs) {
    const bounds = L.latLngBounds(polygonLatLngs);
    let attempts = 0;
    while (attempts < 1000) {
        const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
        const lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
        if (windingNumber([lat, lng], polygonLatLngs.map(p => [p.lat, p.lng]))) {
            return [lat, lng];
        }
        attempts++;
    }
    console.warn("Failed to find point inside polygon.");
    return null;
}

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

// async function pollDronePosition(droneId, intervalMs = 1000) {
//     const position = await getDronePosition(droneId);
//     updateDroneMarker(droneId, position);

//     setTimeout(() => pollDronePosition(droneId, intervalMs), intervalMs);
// }
function startFrontendDroneSimulation(drone) {
    const polygonLatLngs = polygon.getLatLngs()[0];
    // Compute centroid of the polygon
    const latLngs = polygonLatLngs.map(p => [p.lat, p.lng]);
    const centroid = latLngs.reduce((acc, cur) => [acc[0] + cur[0], acc[1] + cur[1]], [0, 0])
        .map(sum => sum / latLngs.length);

    function flyToPolygon() {
        const stepSize = 0.0005;
        const dirLat = centroid[0] - drone.currentLatLng.lat;
        const dirLng = centroid[1] - drone.currentLatLng.lng;
        const distance = Math.sqrt(dirLat * dirLat + dirLng * dirLng);

        if (distance < 0.0003 || windingNumber([drone.currentLatLng.lat, drone.currentLatLng.lng], latLngs)) {
            console.log(`${drone.id} reached the polygon`);
            moveInsidePolygon(); // Start normal random movement
            return;
        }

        const unitLat = dirLat / distance;
        const unitLng = dirLng / distance;

        drone.currentLatLng = L.latLng(
            drone.currentLatLng.lat + unitLat * stepSize,
            drone.currentLatLng.lng + unitLng * stepSize
        );
        drone.marker.setLatLng(drone.currentLatLng);

        drone.animationFrameId = requestAnimationFrame(flyToPolygon);
    }

    function moveInsidePolygon() {
        const stepSize = 0.0003;
        const closeEnoughThreshold = 0.0002;
    
        function chooseNewTarget() {
            const newTarget = getRandomPointInPolygon(polygon.getLatLngs()[0]);
            return newTarget ? L.latLng(newTarget[0], newTarget[1]) : null;
        }
    
        drone.targetLatLng = chooseNewTarget();
    
        function move() {
            // ✅ Check for polygon deletion
            if (!polygon || !polygon.getLatLngs().length) {
                console.log(`Polygon deleted. ${drone.id} returning to standby.`);
                if (drone.animationFrameId) {
                    cancelAnimationFrame(drone.animationFrameId);
                    drone.animationFrameId = null;
                }
                drone.marker.remove();
                waitForPolygonThenStart(drone.id);
                return;
            }
    
            if (!drone.targetLatLng) {
                drone.targetLatLng = chooseNewTarget();
                drone.animationFrameId = requestAnimationFrame(move);
                return;
            }
    
            const dx = drone.targetLatLng.lat - drone.currentLatLng.lat;
            const dy = drone.targetLatLng.lng - drone.currentLatLng.lng;
            const dist = Math.sqrt(dx * dx + dy * dy);
    
            if (dist < closeEnoughThreshold) {
                drone.targetLatLng = chooseNewTarget();
            } else {
                const unitLat = dx / dist;
                const unitLng = dy / dist;
    
                const newLat = drone.currentLatLng.lat + unitLat * stepSize;
                const newLng = drone.currentLatLng.lng + unitLng * stepSize;
    
                const candidate = [newLat, newLng];
                if (windingNumber(candidate, polygon.getLatLngs()[0].map(p => [p.lat, p.lng]))) {
                    drone.currentLatLng = L.latLng(newLat, newLng);
                    drone.marker.setLatLng(drone.currentLatLng);
                } else {
                    drone.targetLatLng = chooseNewTarget();
                }
            }
    
            if (!drone._lastPersist || Date.now() - drone._lastPersist > 2000) {
                drone._lastPersist = Date.now();
                fetch(`http://localhost:5000/api/drone/${drone.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lat: drone.currentLatLng.lat,
                        lng: drone.currentLatLng.lng
                    })
                }).catch(console.error);
            }
    
            drone.animationFrameId = requestAnimationFrame(move);
        }
    
        move();
    }
    
    
    

    flyToPolygon();
}

function waitForPolygonThenStart(droneId) {
    const drone = drones[droneId];
    drone.currentLatLng = L.latLng(drone.currentLatLng); // Start slightly outside polygon
    drone.marker = L.marker(drone.currentLatLng, { icon: droneIcon }).addTo(window.map);
    const checkPolygon = setInterval(() => {
        if (typeof polygon !== "undefined" && polygon && polygon.getLatLngs().length) {
            clearInterval(checkPolygon);
            
            startFrontendDroneSimulation(drone);
        }
    }, 100);
}
const start = () => {
    
};

document.addEventListener("DOMContentLoaded", function () {
    const start = () => {
        if (!drones.drone1.animationFrameId) {
            drones.drone1.animationFrameId = requestAnimationFrame(() => animateDrone("drone1"));
        }
        if (!drones.drone2.animationFrameId) {
            drones.drone2.animationFrameId = requestAnimationFrame(() => animateDrone("drone2"));
        }
        waitForPolygonThenStart("drone1");
        waitForPolygonThenStart("drone2");
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