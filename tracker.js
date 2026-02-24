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

let pathPoints = [], totalDist = 0, startTime = Date.now();
let lastPos = null;

// Initialize Map
const map = L.map('map', { zoomControl: false }).setView([17.5274, 78.5371], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Safety Check for Routing Machine
let router = null;
if (window.L && L.Routing) {
    router = L.Routing.control({
        plan: L.Routing.plan([], { createMarker: () => false }),
        lineOptions: { styles: [{ opacity: 0 }] }, // We draw our own polyline
        show: false,
        addWaypoints: false,
        router: L.Routing.osrmv1({ serviceUrl: `https://router.project-osrm.org/route/v1` })
    }).addTo(map);
}

let polyline = L.polyline([], { color: '#3b82f6', weight: 6, lineJoin: 'round' }).addTo(map);
let marker = L.circleMarker([17.5274, 78.5371], { radius: 8, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map);

function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Timer & Clock
setInterval(() => {
    const now = new Date();
    if(document.getElementById('clock')) 
        document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const diff = Date.now() - startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('t-val').innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}, 1000);

// Tracking Logic
navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude, speed, accuracy } = pos.coords;
    if (accuracy > 60) return;

    const currentPos = [latitude, longitude];
    marker.setLatLng(currentPos);
    
    if(document.getElementById('s-val')) 
        document.getElementById('s-val').innerText = (speed ? speed * 3.6 : 0).toFixed(1) + " km/h";

    if (pathPoints.length === 0) {
        pathPoints.push({ lat: latitude, lng: longitude });
        polyline.addLatLng(currentPos);
        map.setView(currentPos, 17);
        lastPos = { lat: latitude, lng: longitude };
    } else {
        const gap = getDist(lastPos.lat, lastPos.lng, latitude, longitude);

        // If gap is significant (>50m) and router is ready, snap to road
        if (gap > 0.05 && router) {
            router.setWaypoints([L.latLng(lastPos.lat, lastPos.lng), L.latLng(latitude, longitude)]);
            router.once('routesfound', (e) => {
                const route = e.routes[0];
                totalDist += (route.summary.totalDistance / 1000);
                document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";
                route.coordinates.forEach(c => {
                    pathPoints.push({ lat: c.lat, lng: c.lng });
                    polyline.addLatLng([c.lat, c.lng]);
                });
                lastPos = { lat: latitude, lng: longitude };
                map.panTo(currentPos);
            });
        } 
        // Normal small movements
        else if (gap > 0.005) { 
            totalDist += gap;
            document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";
            pathPoints.push({ lat: latitude, lng: longitude });
            polyline.addLatLng(currentPos);
            lastPos = { lat: latitude, lng: longitude };
            map.panTo(currentPos);
        }
    }
}, err => {
    if(err.code === 1) alert("Please enable Location access in your browser settings to track your journey.");
}, { enableHighAccuracy: true });

document.getElementById('stopAction').onclick = async () => {
    if (pathPoints.length < 2) return alert("Please move a bit more before finishing!");
    const durationHrs = (Date.now() - startTime) / 3600000;
    const tripData = {
        mode: localStorage.getItem("cy_mode") || "walking",
        distance: totalDist.toFixed(2),
        avgSpeed: (totalDist / durationHrs).toFixed(1),
        time: document.getElementById('t-val').innerText,
        date: new Date().toLocaleDateString(),
        path: pathPoints
    };
    try {
        await push(ref(db, "rides"), tripData);
        window.location.href = "history.html";
    } catch (e) { alert("Error saving: " + e.message); }
};