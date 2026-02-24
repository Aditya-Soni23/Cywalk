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

// Initial map view at Janapriya Arcadia
const map = L.map('map', { zoomControl: false }).setView([17.5274, 78.5371], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let polyline = L.polyline([], { color: '#3b82f6', weight: 6, lineJoin: 'round' }).addTo(map);
let marker = L.circleMarker([17.5274, 78.5371], { radius: 8, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map);

// Hidden routing control to handle signal gaps
const router = L.Routing.control({
    plan: L.Routing.plan([], { createMarker: () => false }),
    lineOptions: { styles: [{ opacity: 0 }] }, // We don't want the router to draw its own line
    show: false,
    addWaypoints: false
}).addTo(map);

function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// REALTIME CLOCK & TRIP TIMER
setInterval(() => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const clockEl = document.getElementById('clock');
    if(clockEl) clockEl.innerText = timeString;

    const diff = Date.now() - startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    const durationString = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('t-val').innerText = durationString;
}, 1000);

navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude, speed, accuracy } = pos.coords;
    if (accuracy > 60) return;

    const currentPos = [latitude, longitude];
    marker.setLatLng(currentPos);
    
    const speedVal = document.getElementById('s-val');
    if(speedVal) speedVal.innerText = (speed ? speed * 3.6 : 0).toFixed(1) + " km/h";

    if (pathPoints.length === 0) {
        pathPoints.push({ lat: latitude, lng: longitude });
        polyline.addLatLng(currentPos);
        map.setView(currentPos, 17);
    } else {
        const last = pathPoints[pathPoints.length - 1];
        const gap = getDist(last.lat, last.lng, latitude, longitude);

        // GAP HANDLING: If gap is > 50 meters, fetch road route
        if (gap > 0.05) {
            router.setWaypoints([
                L.latLng(last.lat, last.lng),
                L.latLng(latitude, longitude)
            ]);

            router.on('routesfound', (e) => {
                const route = e.routes[0];
                const roadCoords = route.coordinates;
                
                // Add actual road distance to total
                totalDist += (route.summary.totalDistance / 1000);
                document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";

                // Add all intermediate road points to path for perfect "History" viewing
                roadCoords.forEach(c => {
                    pathPoints.push({ lat: c.lat, lng: c.lng });
                    polyline.addLatLng([c.lat, c.lng]);
                });
                map.panTo(currentPos);
            });
        } 
        // NORMAL TRACKING: If gap is small (2m to 50m)
        else if (gap > 0.002) {
            totalDist += gap;
            document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";
            pathPoints.push({ lat: latitude, lng: longitude });
            polyline.addLatLng(currentPos);
            map.panTo(currentPos);
        }
    }
}, null, { enableHighAccuracy: true });

document.getElementById('stopAction').onclick = async () => {
    if (pathPoints.length < 2) return alert("Move more to save traces!");
    
    const durationHrs = (Date.now() - startTime) / 3600000;
    const avgSpeed = (totalDist / durationHrs).toFixed(1);

    const tripData = {
        mode: localStorage.getItem("cy_mode") || "walking",
        distance: totalDist.toFixed(2),
        avgSpeed: avgSpeed,
        time: document.getElementById('t-val').innerText,
        date: new Date().toLocaleDateString(),
        path: pathPoints
    };
    
    try {
        await push(ref(db, "rides"), tripData);
        window.location.href = "history.html";
    } catch (e) {
        alert("Error saving trip!");
    }
};