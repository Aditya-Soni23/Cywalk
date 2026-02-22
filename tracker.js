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

// Janapriya Arcadia, Kowkoor Coordinates
const homeCoords = [17.5274, 78.5371];
let map = L.map('map', { zoomControl: false }).setView(homeCoords, 17);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let pathPoints = [];
let polyline = L.polyline([], {
    color: '#1a73e8', // Google Blue
    weight: 6,
    opacity: 0.9
}).addTo(map);

let totalDist = 0;
let startTime = Date.now();

// Utility: Haversine for distance calculation
function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Update Clock and Timer
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const diff = Date.now() - startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('t-val').innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}, 1000);

// Tracking GPS
navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude, speed, accuracy } = pos.coords;
    if (accuracy > 40) return; // Ignore bad signal

    const currentSpeed = speed ? speed * 3.6 : 0;
    document.getElementById('s-val').innerText = currentSpeed.toFixed(1) + " km/h";

    if (pathPoints.length > 0) {
        const last = pathPoints[pathPoints.length - 1];
        const gap = getDist(last.lat, last.lng, latitude, longitude);
        if (gap > 0.002) { // Moved at least 2 meters
            totalDist += gap;
            document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";
            pathPoints.push({ lat: latitude, lng: longitude });
            polyline.addLatLng([latitude, longitude]);
        }
    } else {
        pathPoints.push({ lat: latitude, lng: longitude });
    }
    map.panTo([latitude, longitude]);
}, err => console.error(err), { enableHighAccuracy: true });

// Finish Session
document.getElementById('stopAction').onclick = async () => {
    const data = {
        mode: localStorage.getItem("cy_mode"),
        distance: totalDist.toFixed(2),
        time: document.getElementById('t-val').innerText,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now()
    };
    await push(ref(db, "rides"), data);
    alert("Trip recorded successfully!");
    window.location.href = "index.html";
};