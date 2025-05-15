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
// Remove near-duplicate points (by rounding coordinates)
function filterValidPoints(points) {
    const unique = [];
    const seen = new Set();

    for (const p of points) {
        const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(p);
        }
    }

    return unique;
}

async function updateVisuals() {
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
    }
}

async function updatePolygon() {
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
    } else {
        polygon = L.polygon(hull, {
            color: '#3388ff',
            weight: 3,
            fillOpacity: 0.3
        }).addTo(map);
    }
}

function clearMap() {
    // Remove all markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Remove all visual elements
    if (polygon) {
        polygon.remove();
        polygon = null;
    }
    if (tempPolyline) {
        tempPolyline.remove();
        tempPolyline = null;
    }
    if (hullPreview) {
        hullPreview.remove();
        hullPreview = null;
    }
    
    // Reset state
    resetPolygon = false;
    
    // Clear from backend too
    fetch(`${API_URL}/polygons`, {
        method: 'DELETE' // You'll need to implement this endpoint
    }).catch(err => console.error('Error clearing polygon:', err));
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

async function completePolygon() {
    const rawPoints = markers.map(m => m.getLatLng());

    if (rawPoints.length < 3) {
        alert("Ymewb ou need at least 3 points to form a polygon");
        return;
    }

    const hull = await convexHull(rawPoints);
    if (!hull || hull.length < 3) {
        alert("Invalid convex hull returned from backend.");
        return;
    }

    // Remove markers that aren't in the final hull
    const keySet = new Set(hull.map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`));
    markers = markers.filter(marker => {
        const { lat, lng } = marker.getLatLng();
        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        if (!keySet.has(key)) {
            map.removeLayer(marker);
            return false;
        }
        return true;
    });

    if (polygon) polygon.remove();
    polygon = L.polygon(hull, {
        color: '#3388ff',
        weight: 3,
        fillOpacity: 0.5
    }).addTo(map);

    resetPolygon = true;
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
    // Enhanced validation
    if (!coordinates || coordinates.length < 4) {
        showSaveFeedback("Invalid polygon - not enough points", true);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/polygons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                coordinates: coordinates.slice(0, -1) // Remove closing point for backend processing
            })
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const result = await response.json();
        showSaveFeedback(result.message || 'Area saved successfully!');
        console.log('Saved hull coordinates:', coordinates);

    } catch (error) {
        console.error('Save error:', error);
        showSaveFeedback('Save failed: ' + error.message, true);
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
        showSaveFeedback("Invalid polygon - not enough points to delete", true);
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
        showSaveFeedback(result.message || 'Area deleted successfully!');
        console.log('Deleted polygon coordinates:', coordinates);

    } catch (error) {
        console.error('Delete error:', error);
        showSaveFeedback('Delete failed: ' + error.message, true);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    window.map = L.map('map').setView([55.7068, 13.1870], 13);
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google Satellite'
      }).addTo(map);


    const clearButton = L.control({ position: 'topright' });
    clearButton.onAdd = function () {
        const div = L.DomUtil.create('div', 'red-button');
        div.innerHTML = '<button>Clear Points</button>';
        div.onclick = function (e) {
            e.stopPropagation();
            clearMap();
        };
        return div;
    };
    clearButton.addTo(map);

    map.on('click', onMapClick);
}); 