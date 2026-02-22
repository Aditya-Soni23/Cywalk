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

// State
let pathPoints = []; 
let totalDist = 0;
let startTime = Date.now();

// Map Setup
const map = L.map('map', { zoomControl: false }).setView([0, 0], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let polyline = L.polyline([], { color: '#2563eb', weight: 6, opacity: 0.8 }).addTo(map);
let userMarker = L.circleMarker([0, 0], { radius: 8, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }).addTo(map);

function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// UI Clock
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diff = Date.now() - startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('t-val').innerText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}, 1000);

// GPS Tracking
navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude, speed, accuracy } = pos.coords;
    
    // Accuracy filter: Ignore if signal is very poor (> 60 meters error)
    if (accuracy > 60) return; 

    const currentPos = [latitude, longitude];
    const currentPoint = { lat: latitude, lng: longitude };

    userMarker.setLatLng(currentPos);
    document.getElementById('s-val').innerText = (speed ? speed * 3.6 : 0).toFixed(1) + " km/h";

    if (pathPoints.length === 0) {
        // Record the very first point immediately
        pathPoints.push(currentPoint);
        polyline.addLatLng(currentPos);
        map.setView(currentPos, 17);
    } else {
        const last = pathPoints[pathPoints.length - 1];
        const gap = getDist(last.lat, last.lng, latitude, longitude);
        
        // Record point if moved more than 2 meters
        if (gap > 0.002) { 
            totalDist += gap;
            document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";
            pathPoints.push(currentPoint);
            polyline.addLatLng(currentPos);
            map.panTo(currentPos);
        }
    }
}, err => console.error(err), { enableHighAccuracy: true });

// Finish Trip
document.getElementById('stopAction').onclick = async () => {
    if (pathPoints.length < 2) {
        alert("Trip too short to save map traces. Walk a bit more!");
        return;
    }

    const btn = document.getElementById('stopAction');
    btn.innerText = "Saving...";
    btn.disabled = true;

    const tripData = {
        mode: localStorage.getItem("cy_mode") || "walking",
        distance: totalDist.toFixed(2),
        time: document.getElementById('t-val').innerText,
        date: new Date().toLocaleString(),
        path: pathPoints, // The traces
        timestamp: Date.now()
    };

    try {
        await push(ref(db, "rides"), tripData);
        window.location.href = "history.html";
    } catch (e) {
        alert("Save failed!");
        btn.innerText = "Finish Trip";
        btn.disabled = false;
    }
};