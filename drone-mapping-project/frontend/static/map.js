const markers = [];
document.addEventListener("DOMContentLoaded", function () {
    var map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    resetPolygon = false;
    var polygon;
    function onMapClick(e) {
        if (resetPolygon) {
            markers.forEach(marker => marker.remove());
            markers.length = 0; // Clear the markers array
            polygon.remove();
            resetPolygon = false;
        }
        var marker = L.marker(e.latlng , {icon : xIcon}).addTo(map);
        markers.push(marker);

        if (completePolygon()) {
            markers[markers.length -1].remove();
            markers.pop();
            polygon = L.polygon(markers.map(marker => marker.getLatLng())).addTo(map);
            resetPolygon = true;
        }
    }

    map.on('click', onMapClick);
});

function completePolygon() {
    if (markers.length == 1){
        return false;
    }
    var head = markers[0].getLatLng();
    head = [Math.round(head.lat * 100) / 100 , Math.round(head.lng * 100) / 100];
    var tail = markers[markers.length -1].getLatLng();
    tail = [Math.round(tail.lat * 100) / 100 , Math.round(tail.lng * 100) / 100];
    var result =  JSON.stringify(head) === JSON.stringify(tail);

    return result;
}
const xIcon = L.divIcon({
    className: 'custom-x-icon', // Custom CSS class
    html: '<div style="color: red; font-size: 24px; font-weight: bold;">X</div>', // "X" in red
    iconSize: [24, 24], // Size of the icon
    iconAnchor: [12, 12] // Anchor point of the icon (centered)
});