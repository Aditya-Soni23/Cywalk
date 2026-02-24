import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBv9lQi7pbdg-usNwd2HOhdpwT2OBVfr34",
    authDomain: "cywalk-eddc3.firebaseapp.com",
    databaseURL: "https://cywalk-eddc3-default-rtdb.firebaseio.com",
    projectId: "cywalk-eddc3",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Initialize Map
const map = L.map('map', { zoomControl: false }).setView([17.5274, 78.5371], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Routing Control
let control = L.Routing.control({
    waypoints: [],
    routeWhileDragging: true,
    addWaypoints: false, // We control waypoints via our button
    show: false, // Hide text directions
    lineOptions: {
        styles: [{ color: '#38bdf8', weight: 6 }]
    },
    createMarker: function(i, wp) {
        return L.marker(wp.latLng, {
            draggable: true,
            icon: L.divIcon({
                className: 'custom-pin',
                html: `<div style="background:white; color:black; border:2px solid #38bdf8; 
                        border-radius:50%; width:25px; height:25px; display:flex; 
                        align-items:center; justify-content:center; font-weight:bold;">${i + 1}</div>`,
                iconSize: [25, 25]
            })
        }).on('dragend', function() {
            updateRoute();
        });
    }
}).addTo(map);

let waypoints = [];
let totalDistanceKm = 0;

// Add Stop Button
document.getElementById('addStop').onclick = () => {
    const center = map.getCenter();
    waypoints.push(L.latLng(center.lat, center.lng));
    control.setWaypoints(waypoints);
};

// Update distance when route is calculated
control.on('routesfound', function(e) {
    const routes = e.routes;
    totalDistanceKm = (routes[0].summary.totalDistance / 1000).toFixed(2);
});

function updateRoute() {
    const currentWps = control.getWaypoints();
    waypoints = currentWps.map(w => w.latLng).filter(l => l !== null);
}

// Finish Button
document.getElementById('finishRoute').onclick = () => {
    if (waypoints.length < 2) return alert("Add at least 2 stops!");
    document.getElementById('timeModal').style.display = 'flex';
};

// Save to Firebase
document.getElementById('saveManualTrip').onclick = async () => {
    const mins = document.getElementById('minutesInput').value;
    if (!mins || mins <= 0) return alert("Please enter valid minutes");

    // GET THE FULL ROAD PATH
    // This looks at the actual blue line on the map, not just your 1, 2, 3 pins
    const currentRoute = control.getPlan().getWaypoints();
    if (currentRoute.length < 2) return alert("Route error");

    // We fetch the actual coordinates of the calculated road from the routing engine
    const routes = control._selectedRoute; 
    const fullRoadPath = routes.coordinates.map(c => ({ lat: c.lat, lng: c.lng }));

    const hours = mins / 60;
    const avgSpeed = (totalDistanceKm / hours).toFixed(1);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const durationStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;

    const tripData = {
        mode: "planned",
        distance: totalDistanceKm,
        avgSpeed: avgSpeed,
        time: durationStr,
        date: new Date().toLocaleDateString(),
        path: fullRoadPath // SAVING THE FULL ROAD DATA NOW
    };

    try {
        await push(ref(db, "rides"), tripData);
        window.location.href = "history.html";
    } catch (e) {
        console.error(e);
        alert("Error saving!");
    }
};