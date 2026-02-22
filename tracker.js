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

// Change the [0, 0] to your home coordinates
const map = L.map('map', { zoomControl: false }).setView([17.5274, 78.5371], 16);

// Use the reliable Light Mode OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let polyline = L.polyline([], { color: '#3b82f6', weight: 6 }).addTo(map);
let marker = L.circleMarker([0, 0], { radius: 8, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map);

function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude, speed, accuracy } = pos.coords;
    if (accuracy > 60) return;

    const currentPos = [latitude, longitude];
    marker.setLatLng(currentPos);
    document.getElementById('s-val').innerText = (speed ? speed * 3.6 : 0).toFixed(1) + " km/h";

    if (pathPoints.length === 0) {
        pathPoints.push({ lat: latitude, lng: longitude });
        polyline.addLatLng(currentPos);
        map.setView(currentPos, 17);
    } else {
        const last = pathPoints[pathPoints.length - 1];
        const gap = getDist(last.lat, last.lng, latitude, longitude);
        if (gap > 0.002) {
            totalDist += gap;
            document.getElementById('d-val').innerText = totalDist.toFixed(2) + " km";
            pathPoints.push({ lat: latitude, lng: longitude });
            polyline.addLatLng(currentPos);
            map.panTo(currentPos);
        }
    }
}, null, { enableHighAccuracy: true });

setInterval(() => {
    const diff = Date.now() - startTime;
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    document.getElementById('t-val').innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}, 1000);

document.getElementById('stopAction').onclick = async () => {
    if (pathPoints.length < 2) return alert("Move more to save traces!");
    
    const durationHrs = (Date.now() - startTime) / 3600000;
    const avgSpeed = (totalDist / durationHrs).toFixed(1);

    const tripData = {
        mode: localStorage.getItem("cy_mode"),
        distance: totalDist.toFixed(2),
        avgSpeed: avgSpeed,
        time: document.getElementById('t-val').innerText,
        date: new Date().toLocaleDateString(),
        path: pathPoints
    };
    await push(ref(db, "rides"), tripData);
    window.location.href = "history.html";
};