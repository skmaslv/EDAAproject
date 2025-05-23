window.map = null;
const API_URL = 'http://localhost:5000/api';
let markers = [];
let polygon = null;
let tempPolyline = null;
let hullPreview = null;
let resetPolygon = false;

const xIcon = L.divIcon({
    className: 'custom-x-icon',
    html: '<div style="color: white; font-size: 24px; font-weight: bold;">X</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});


async function updateVisuals() {
    console.log('Updating visuals with markers:', markers);
    // Clear any old lines or previews
    if (tempPolyline) {
        map.removeLayer(tempPolyline);
        tempPolyline = null;
    }
    if (hullPreview) {
        map.removeLayer(hullPreview);
        hullPreview = null;
    }

    if (markers.length === 0) return;

    // Show dashed polyline between points
    if (markers.length > 1) {
        tempPolyline = L.polyline(
            markers.map(m => m.getLatLng()), 
            { color: 'gray', dashArray: '5,5', weight: 2 }
        ).addTo(map);
    }

    // Get points and request hull from backend
    const rawPoints = markers.map(m =>  m.getLatLng());

    const hull = await ConvexHull(rawPoints);

    if (hull && hull.length >= 3) {
        console.log('Hull points:', hull);
        hullPreview = L.polygon(hull, {
            color: '#3388ff',
            weight: 2,
            fillOpacity: 0.3
        }).addTo(map);
        invisibleMarkers();
    }
    
}

async function loadPolygonsFromRedis() {
    console.log('Loading polygons from Redis');
    try {
        const response = await fetch(`${API_URL}/polygons`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const result = await response.json();
        console.log('Loaded polygons:', result);

        if (result.polygons && result.polygons.length > 0) {
            result.polygons.forEach(polygonData => {
                polygon = L.polygon(polygonData, {
                    color: '#3388ff',
                    weight: 3,
                    fillOpacity: 0.5
                }).addTo(map);

                // Create hidden markers from polygon points
                clearMarkers();
                polygonData.forEach(coord => {
                    const latlng = L.latLng(coord[0], coord[1]);
                    const marker = L.marker(latlng, {
                        icon: xIcon,
                        draggable: false,
                        opacity: 0 // Start as invisible
                    }).addTo(map);

                    marker.on('contextmenu', (e) => {
                        e.originalEvent.preventDefault();
                        deleteMarker(marker);
                    });

                    markers.push(marker);
                });
            });
        }

    } catch (error) {
        console.error('Load error:', error);
        //showSaveFeedback('Load failed: ' + error.message, true);
    }
}


async function updatePolygon() {
    console.log('Updating polygon with markers:', markers);
    const rawPoints = markers.map(m => m.getLatLng());

    if (rawPoints.length < 3) {
        if (polygon) {
            map.removeLayer(polygon);
            polygon = null;
        }
        return;
    }

    const hull = await convexHull(rawPoints);
    if (!hull || hull.length < 3) {
        if (polygon) {
            map.removeLayer(polygon);
            polygon = null;
        }
        return;
    }

    if (polygon) {
        polygon.setLatLngs(hull);
        invisibleMarkers();
    } else {
        // Create a new polygon if it doesn't exist
        polygon = L.polygon(hull, {
            color: '#3388ff',
            weight: 3,
            fillOpacity: 0.3
        }).addTo(map);
        invisibleMarkers();
    }
    const formattedHull = hull.map(p => [p.lat, p.lng]);
    console.log('Formatted hull:', formattedHull);
    await sendPolygonToRedis(formattedHull);
    
}

function clearMap() {
    // Remove all markers
    console.log('Clearing all markers');
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Remove visuals
    if (polygon) {
        const coords = polygon.getLatLngs()[0].map(p => [p.lat, p.lng]);
        polygon.remove();
        polygon = null;

        // 🔥 Actually delete from backend
        deletePolygonFromRedis(coords); 
    }

    if (tempPolyline) {
        tempPolyline.remove();
        tempPolyline = null;
    }
    if (hullPreview) {
        hullPreview.remove();
        hullPreview = null;
    }

    resetPolygon = false;
    updatePolygon();
    updateVisuals();
    loadPolygonsFromRedis();

}



function onMapClick(e) {
    if (resetPolygon) {
        clearMap();
        resetPolygon = false;
        return;
    }

    const marker = L.marker(e.latlng, {
        icon: xIcon,
        draggable: false
    }).addTo(map);

    marker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault();
        deleteMarker(marker);
    });
    
    markers.push(marker);
    updatePolygon(); // Try to draw live preview of hull from backend
}


function deleteMarker(marker) {
    map.removeLayer(marker);
    markers = markers.filter(m => m !== marker);
    updateVisuals();
    if (polygon) updatePolygon();

}

function invisibleMarkers() {
    markers.forEach(marker => {
        marker.setOpacity(0);
    });
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function showSaveFeedback(message, isError = false) {
    const feedback = document.createElement('div');
    feedback.className = `save-feedback ${isError ? 'error' : ''}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.classList.add('fade-out');
        setTimeout(() => feedback.remove(), 1000);
    }, 2000);
}

async function sendPolygonToRedis(coordinates) {
    console.log('Sending polygon to Redis:', coordinates);
    // Enhanced validation
    if (!coordinates || coordinates.length < 3) {
        //showSaveFeedback("Invalid polygon - not enough points", true);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/polygons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                coordinates: coordinates // Remove closing point for backend processing
            })
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const result = await response.json();
        //showSaveFeedback(result.message || 'Area saved successfully!');
        console.log('Saved hull coordinates:', coordinates);

    } catch (error) {
        console.error('Save error:', error);
        //showSaveFeedback('Save failed: ' + error.message, true);
    }
}

// Convex hull implementation (Andrew's monotone chain algorithm)
function convexHull(points) {
    if (points.length <= 1) return points;

    points = points.slice().sort((a, b) => a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng);

    const lower = [];
    for (const point of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
            lower.pop();
        }
        lower.push(point);
    }

    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
            upper.pop();
        }
        upper.push(point);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

function cross(a, b, o) {
    return (a.lat - o.lat) * (b.lng - o.lng) - (a.lng - o.lng) * (b.lat - o.lat);
}


async function deletePolygonFromRedis(coordinates) {
    if (!coordinates || coordinates.length < 3) {
        //showSaveFeedback("Invalid polygon - not enough points to delete", true);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/polygons`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                coordinates: coordinates.slice(0, -1) // match backend expectations
            })
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const result = await response.json();
        //showSaveFeedback(result.message || 'Area deleted successfully!');
        console.log('Deleted polygon coordinates:', coordinates);

    } catch (error) {
        console.error('Delete error:', error);
        //showSaveFeedback('Delete failed: ' + error.message, true);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    window.map = L.map('map').setView([55.7068, 13.1870], 13);
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google Satellite'
    }).addTo(map);

    // Load polygons from Redis when the page loads
    loadPolygonsFromRedis();

    const clearButton = L.control({ position: 'topright' });
    clearButton.onAdd = function () {
        const div = L.DomUtil.create('div', 'red-button');
        div.innerHTML = '<button>Clear Points</button>';
        div.onclick = function (e) {
            e.stopPropagation();
            
            // First remove all drones by triggering their remove buttons
            if (window.drones) {
                Object.keys(window.drones).forEach(droneId => {
                    if (window.removeDrone) {
                        window.removeDrone(droneId);
                    }
                });
            }
            
            // Then clear the polygon points
            clearMap();
        };
        return div;
    };
    clearButton.addTo(map);

    map.on('click', onMapClick);
});
