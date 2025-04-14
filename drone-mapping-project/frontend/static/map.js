window.map = null;
const API_URL = 'http://localhost:5000/api';
let markers = [];
let polygon = null;
let tempPolyline = null;
let hullPreview = null;
let resetPolygon = false;

const xIcon = L.divIcon({
    className: 'custom-x-icon',
    html: '<div style="color: red; font-size: 24px; font-weight: bold;">X</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

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

function updateVisuals() {
    // Remove ALL previous visual layers first
    if (tempPolyline) {
        map.removeLayer(tempPolyline);
        tempPolyline = null;
    }
    if (hullPreview) {
        map.removeLayer(hullPreview);
        hullPreview = null;
    }

    // Only proceed if we have markers
    if (markers.length === 0) return;

    // Show temp polyline if there are at least 2 points
    if (markers.length > 1) {
        tempPolyline = L.polyline(
            markers.map(m => m.getLatLng()), 
            {color: 'gray', dashArray: '5,5', weight: 2}
        ).addTo(map);
    }

    // Filter points and compute hull
    const rawPoints = markers.map(m => m.getLatLng());
    const validPoints = filterValidPoints(rawPoints);
    const hullPoints = convexHull(validPoints);

    // Show SINGLE convex hull preview
    if (hullPoints.length >= 3) {
        hullPreview = L.polygon(hullPoints, {
            color: '#3388ff',
            weight: 2,
            fillOpacity: 0.3 // Keep this low for preview
        }).addTo(map);
    }
} 

function updatePolygon() {
    if (markers.length < 3) {
        if (polygon) {
            polygon.remove();
            polygon = null;
        }
        return;
    }

    const rawPoints = markers.map(m => m.getLatLng());
    const validPoints = filterValidPoints(rawPoints);
    const hullPoints = convexHull(validPoints);

    if (polygon) {
        polygon.setLatLngs(hullPoints);
    } else {
        polygon = L.polygon(hullPoints, {
            color: '#3388ff',
            weight: 3,
            fillOpacity: 0.5
        }).addTo(map);
    }

    const coordinates = [...hullPoints, hullPoints[0]].map(p => [p.lat, p.lng]);
    sendPolygonToRedis(coordinates);
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

    // Add the new marker temporarily
    const newMarker = L.marker(e.latlng, {
        icon: xIcon,
        draggable: true
    }).addTo(map);

    // Create temporary markers array including the new one
    const tempMarkers = [...markers, newMarker];
    const tempPoints = tempMarkers.map(m => m.getLatLng());
    const validPoints = filterValidPoints(tempPoints);
    const hullPoints = convexHull(validPoints);

    // Check if the new point is part of the hull
    const isOnHull = hullPoints.some(p => 
        p.lat.toFixed(6) === e.latlng.lat.toFixed(6) && 
        p.lng.toFixed(6) === e.latlng.lng.toFixed(6)
    );

    if (!isOnHull) {
        map.removeLayer(newMarker);
        return; // Don't add the marker if it's not on the hull
    }

    // If we get here, the point is valid
    const marker = newMarker;
    
    marker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault();
        deleteMarker(marker);
    });

    marker.on('dragend', () => {
        // After dragging, check if the marker is still valid
        const currentPos = marker.getLatLng();
        const tempPoints = markers.map(m => m === marker ? currentPos : m.getLatLng());
        const validPoints = filterValidPoints(tempPoints);
        const hullPoints = convexHull(validPoints);
        
        const isStillValid = hullPoints.some(p => 
            p.lat.toFixed(6) === currentPos.lat.toFixed(6) && 
            p.lng.toFixed(6) === currentPos.lng.toFixed(6)
        );
        
        if (!isStillValid) {
            // Move back to original position
            marker.setLatLng(e.target._latlng);
            alert("This position would make the point invalid for the convex hull");
        } else {
            updateVisuals();
            if (polygon) updatePolygon();
        }
    });

    markers.push(marker);
    updateVisuals();
}

function deleteMarker(marker) {
    map.removeLayer(marker);
    markers = markers.filter(m => m !== marker);
    updateVisuals();
    if (polygon) updatePolygon();
}

function completePolygon() {
    if (markers.length < 3) {
        alert("You need at least 3 points to create a polygon");
        return false;
    }

    // Get current valid points
    const rawPoints = markers.map(m => m.getLatLng());
    const validPoints = filterValidPoints(rawPoints);
    const hullPoints = convexHull(validPoints);

    // Remove any markers that aren't part of the final hull
    markers.forEach(marker => {
        const latlng = marker.getLatLng();
        const isInFinalHull = hullPoints.some(p => 
            p.lat.toFixed(6) === latlng.lat.toFixed(6) && 
            p.lng.toFixed(6) === latlng.lng.toFixed(6)
        );
        
        if (!isInFinalHull) {
            deleteMarker(marker);
        }
    });

    // Proceed with creating the final polygon
    if (hullPoints.length < 3) {
        alert("Invalid polygon - could not calculate convex hull");
        return false;
    }

    if (polygon) polygon.remove();
    polygon = L.polygon(hullPoints, {
        color: '#3388ff',
        weight: 3,
        fillOpacity: 0.5
    }).addTo(map);

    // Clear temporary elements
    if (tempPolyline) tempPolyline.remove();
    if (hullPreview) hullPreview.remove();

    // Prepare coordinates
    const coordinates = hullPoints.map(p => [p.lat, p.lng]);
    coordinates.push([hullPoints[0].lat, hullPoints[0].lng]);

    // Save to database
    sendPolygonToRedis(coordinates);

    resetPolygon = true;
    return true;
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

document.addEventListener("DOMContentLoaded", function () {
    window.map = L.map('map').setView([55.7068, 13.1870], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const completeButton = L.control({ position: 'topright' });
    completeButton.onAdd = function () {
        const div = L.DomUtil.create('div', 'complete-btn');
        div.innerHTML = '<button>Complete Area</button>';
        div.onclick = function (e) {
            e.stopPropagation();
            completePolygon();
        };
        return div;
    };
    completeButton.addTo(map);

    const clearButton = L.control({ position: 'topright' });
    clearButton.onAdd = function () {
        const div = L.DomUtil.create('div', 'clear-btn');
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