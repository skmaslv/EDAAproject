let drones = {};
let totaldrones = 0;
let manuallyControlledDroneId = null;
// Function to generate a random color
const DISTINCT_COLORS = [
  "#e6194b","#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0",
  "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324", "#fffac8",
  "#800000", "#aaffc3", "#808000", "#ffd8b1", "#000075", "#a9a9a9"
];

const assignedColors = new Set();

function getNextColor() {
  for (const color of DISTINCT_COLORS) {
    if (!assignedColors.has(color)) {
      assignedColors.add(color);
      return color;
    }
  }
  // fallback: random color
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}
function getNextColor() {
  for (const color of DISTINCT_COLORS) {
    if (!assignedColors.has(color)) {
      assignedColors.add(color);
      return color;
    }
  }
  // fallback: random color
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}
// Function to load drones from localStorage
function loadDrones() {
    const savedDrones = localStorage.getItem('drones');
    assignedColors.clear(); // Clear the set of assigned colors
    if (savedDrones) {
        const parsedDrones = JSON.parse(savedDrones);
        drones = parsedDrones.drones;
        totaldrones = parsedDrones.totaldrones;
        
        // Recreate the icon objects (they can't be stored in localStorage)
        for (const droneId in drones) {
            const drone = drones[droneId];
            drone.icon = L.divIcon({
                html: drone.icon.html,
                iconSize: drone.icon.iconSize,
                iconAnchor: drone.icon.iconAnchor
            });
            drone.currentLatLng = L.latLng(drone.currentLatLng.lat, drone.currentLatLng.lng);
            if (drone.targetLatLng) {
                drone.targetLatLng = L.latLng(drone.targetLatLng.lat, drone.targetLatLng.lng);
            }
            drone.animationFrameId = null;
            drone.marker = null;
            assignedColors.add(drone.color); // Add the color to the set
        }
        
        updateDroneList();
        start();
    }
}

// Function to save drones to localStorage
function saveDrones() {
    const dronesToSave = {
        drones: {},
        totaldrones: totaldrones
    };
    
    for (const droneId in drones) {
        const drone = drones[droneId];
        dronesToSave.drones[droneId] = {
            id: drone.id,
            currentLatLng: drone.currentLatLng,
            targetLatLng: drone.targetLatLng,
            icon: {
                html: drone.icon.options.html,
                iconSize: drone.icon.options.iconSize,
                iconAnchor: drone.icon.options.iconAnchor
            },
            color: drone.icon.options.html.match(/fill="([^"]+)"/)[1] // Extract color from SVG
        };
    }
    
    localStorage.setItem('drones', JSON.stringify(dronesToSave));
    console.log("Drones saved to localStorage:", dronesToSave);
}

function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = 'elegant-notification';
    notification.innerHTML = `
        <div class="notification-header">${title}</div>
        <div class="notification-body">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Show for 5 seconds (5000ms) before fading out
    setTimeout(() => {
        notification.classList.add('fade-out');
        // Remove after fade completes
        setTimeout(() => notification.remove(), 500);
    }, 7000); 
}

function addDrone() {
    if (!polygon || !polygon.getLatLngs() || polygon.getLatLngs()[0].length < 3) {
        showNotification("Please create a flight area first", "Draw a polygon on the map to define where drones can fly");
        return null;
    }
    
    //hererererererererererer
    const currentlyControlled = manuallyControlledDroneId;


    const droneId = totaldrones++;
    drones[droneId] = {
        id: droneId,
        marker: null,
        currentLatLng: [55.705 + getRandomOffset(0.002), 13.188 + getRandomOffset(0.002)],
        targetLatLng: null,
        animationFrameId: null,
        icon: L.divIcon({
            html: `<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="m6 3a3 3 0 0 0 -3 3 3 3 0 0 0 3 3 3 3 0 0 0 1.0859375-.2070312c.5392711.8209481.9140625 1.6424172.9140625 2.2070312 0 .563623-.3724493 1.384498-.9101562 2.205078a3 3 0 0 0 -1.0898438-.205078 3 3 0 0 0 -3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 -.2050781-1.080078c.8233483-.542436 1.6446221-.919922 2.2050781-.919922.55949 0 1.37815.375313 2.201172.916016a3 3 0 0 0 -.201172 1.083984 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 -3-3 3 3 0 0 0 -1.085938.207031c-.539273-.820943-.914062-1.642417-.914062-2.207031 0-.563623.372445-1.3844956.910156-2.2050781a3 3 0 0 0 .002.00195 3 3 0 0 0 1.087844.2031281 3 3 0 0 0 3-3 3 3 0 0 0 -3-3 3 3 0 0 0 -3 3 3 3 0 0 0 .205078 1.0800781c-.823351.5424443-1.644622.9199219-2.205078.9199219-.55949 0-1.3781473-.3753084-2.2011719-.9160156a3 3 0 0 0 .2011719-1.0839844 3 3 0 0 0 -3-3zm0 1a2 2 0 0 1 2 2 2 2 0 0 1 -.0527344.453125c-.4577913-.368834-.8926099-.7589139-1.2402344-1.1601562a1 1 0 0 0 -.6933593-.2929688 1 1 0 0 0 -.7207031.2929688 1 1 0 0 0 0 1.4140624 1 1 0 0 0 .058594.054688c.3824613.333788.7551689.7476371 1.1074216 1.1835933a2 2 0 0 1 -.4589844.0546875 2 2 0 0 1 -2-2 2 2 0 0 1 2-2zm10 0a2 2 0 0 1 2 2 2 2 0 0 1 -2 2 2 2 0 0 1 -.457031-.054687c.37051-.4592027.761959-.8951713 1.164062-1.2382813a1 1 0 0 0 0-1.4140624 1 1 0 0 0 -1.414062 0 1 1 0 0 0 -.05274.054687c-.337606.3818392-.750702.7543351-1.185541 1.1054687a2 2 0 0 1 -.054688-.453125 2 2 0 0 1 2-2zm-10 10a2 2 0 0 1 .4570312.05469c-.3705108.459203-.7619484.895165-1.1640624 1.238281a1 1 0 0 0 0 1.414062 1 1 0 0 0 1.4140624 0 1 1 0 0 0 .052734-.05469c.3376223-.381857.7507063-.754333 1.1855473-1.105468a2 2 0 0 1 .0546875.453125 2 2 0 0 1 -2 2 2 2 0 0 1 -2-2 2 2 0 0 1 2-2zm10 0a2 2 0 0 1 2 2 2 2 0 0 1 -2 2 2 2 0 0 1 -2-2 2 2 0 0 1 .05273-.453125c.457792.368835.892604.758903 1.240235 1.160156a1 1 0 0 0 1.414062 0 1 1 0 0 0 0-1.414062c-.01717-.01465-.0336-.03387-.05078-.04883a1 1 0 0 0 -.0078-.0059c-.382475-.333732-.755177-.747602-1.107431-1.183551a2 2 0 0 1 .458984-.054688z" fill="${getNextColor()}" stroke="#000000" stroke-width="0.5"/></svg>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    };
    
    if (currentlyControlled !== null) {
        manuallyControlledDroneId = currentlyControlled;
    }

    updateDroneList();
    start();
    saveDrones(); 
    return droneId;
}

// Function to remove a drone
function removeDrone(droneId) {
    if (drones[droneId]) {
        map.removeLayer(drones[droneId].marker);
        delete drones[droneId];
        updateDroneList();
        saveDrones(); 
    }
}
// Function to generate random offset (in degrees)
function getRandomOffset(maxOffset = 0.01) {
    return (Math.random() * maxOffset * 2) - maxOffset; // Returns value between -maxOffset and +maxOffset
}

 // Small random offset to longitude (~200m)
// Function to update the drone list in the management panel
function updateDroneList() {
    const droneList = document.getElementById('drone-list');
    droneList.innerHTML = '';
    
    for (const droneId in drones) {
        const drone = drones[droneId];
        const listItem = document.createElement('li');
        listItem.className = 'drone-list-item'; // Add class for styling
        
        // Get the SVG HTML from the drone's icon
        const svgHtml = drone.icon.options.html;
        const isControlled = manuallyControlledDroneId === droneId;
        
        listItem.innerHTML = `
            <div class="drone-icon-container">${svgHtml}</div>
            <div class="drone-controls">
                <button class="button retro-button" onclick="removeDrone('${droneId}')">Remove</button>
                <button class="button retro-button ${isControlled ? 'active' : ''}" 
                        onclick="toggleManualControl('${droneId}')">
                    ${isControlled ? 'Release Control' : 'Control Manually'}
                </button>
            </div>
        `;
        droneList.appendChild(listItem);
    }
}



// Initialize the drone list
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


function animateDrone(droneId) {
    const drone = drones[droneId];
    
    if (manuallyControlledDroneId === droneId) {
        return;
    }

    if (!drone.currentLatLng || !drone.targetLatLng) {
        drone.animationFrameId = requestAnimationFrame(() => animateDrone(droneId));
        return;
    }

    const step = 0.05; // Adjust for smoothness (lower = smoother/slower)

    const lat = drone.currentLatLng.lat + (drone.targetLatLng.lat - drone.currentLatLng.lat) * step;
    const lng = drone.currentLatLng.lng + (drone.targetLatLng.lng - drone.currentLatLng.lng) * step;

    drone.currentLatLng = L.latLng(lat, lng);
    drone.marker.setLatLng(drone.currentLatLng);
    saveDrones();  // Save the drone's position to localStorage

    drone.animationFrameId = requestAnimationFrame(() => animateDrone(droneId));
}

function startFrontendDroneSimulation(drone) {
    if (manuallyControlledDroneId === drone.id) {
        return;
    }
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

            drone.animationFrameId = requestAnimationFrame(move);
        }

        move();
    }

    flyToPolygon();
}


function toggleManualControl(droneId) {
    if (manuallyControlledDroneId === droneId) {
        // Release control
        manuallyControlledDroneId = null;
        
        // Restart automated behavior
        const drone = drones[droneId];
        if (drone.animationFrameId) {
            cancelAnimationFrame(drone.animationFrameId);
        }
        startFrontendDroneSimulation(drone);
    } else {
        // If another drone is being controlled, release it first
        if (manuallyControlledDroneId !== null) {
            toggleManualControl(manuallyControlledDroneId);
        }
        
        // Take control of this drone
        manuallyControlledDroneId = droneId;
        const drone = drones[droneId];
        
        // Stop automated behavior
        if (drone.animationFrameId) {
            cancelAnimationFrame(drone.animationFrameId);
            drone.animationFrameId = null;
        }
        
        // Freeze the drone in place
        drone.targetLatLng = drone.currentLatLng;
    }
    
    updateDroneList();
}

function waitForPolygonThenStart(droneId) {
    const drone = drones[droneId];
    drone.currentLatLng = L.latLng(drone.currentLatLng); // Start slightly outside polygon
    drone.marker = L.marker(drone.currentLatLng, { icon: drone.icon }).addTo(window.map);
    const checkPolygon = setInterval(() => {
        if (typeof polygon !== "undefined" && polygon && polygon.getLatLngs().length) {
            clearInterval(checkPolygon);

            startFrontendDroneSimulation(drone);
        }
    }, 100);
}

function startPositionSync(intervalMs = 2000) { // adjust intervalMs as needed
    setInterval(() => {
        saveDrones();
    }, intervalMs);
}

const start = () => {
    for (const droneId in drones) {
        const drone = drones[droneId];
        
        // Skip if this is the manually controlled drone
        if (manuallyControlledDroneId === droneId) continue;

        if (drone.animationFrameId) {
            cancelAnimationFrame(drone.animationFrameId);
        }
        if (drone.marker) {
            drone.marker.remove();
        }
        waitForPolygonThenStart(droneId);
    }
};

// Event listener for the add drone button
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById('add-drone-btn').addEventListener('click', function() {
        const droneId = addDrone();
        if (droneId === null) {
            // Show a more user-friendly message if needed
            console.log("Cannot add drone - no polygon exists");
        }
    });

    // Add this to your initialization code (DOMContentLoaded event)
    document.addEventListener('keydown', (e) => {
      if (manuallyControlledDroneId !== null) {
          const drone = drones[manuallyControlledDroneId];
          if (!drone) return;

          const step = 0.0008; // Adjust this value for movement speed
          let newLat = drone.currentLatLng.lat;
          let newLng = drone.currentLatLng.lng;

          switch (e.key.toLowerCase()) {
              case 'w':
                  newLat += step;
                  break;
              case 's':
                  newLat -= step;
                  break;
              case 'a':
                  newLng -= step;
                  break;
              case 'd':
                  newLng += step;
                  break;
              default:
                  return; // Ignore other keys
          }

          // Update drone position
          drone.currentLatLng = L.latLng(newLat, newLng);
          drone.marker.setLatLng(drone.currentLatLng);

          saveDrones(); // Save the drone's position to localStorage
      }
  });
    });


window.drones = drones;
window.removeDrone = removeDrone;
window.updateDroneList = updateDroneList;
window.saveDrones = saveDrones;