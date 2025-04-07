const droneIcon = L.icon({
    iconUrl: "/static/images/uav-quadcopter.svg",
    iconSize: [30, 30], // Size of the icon
    iconAnchor: [15, 15] // Anchor point of the icon (centered)
});

document.addEventListener("DOMContentLoaded", function () {
    // Wait until map is ready
    if (window.map) {
        L.marker([55.7068, 13.1870], { icon: droneIcon }).addTo(window.map);
    }
});