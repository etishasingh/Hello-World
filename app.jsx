import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { collection, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { db } from "./firebase";

// fixes the broken marker icon issue with vite
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow });

function ClickCatcher({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

export default function App() {
  const [view, setView] = useState("map");
  const [reports, setReports] = useState([]);
  const [newPoint, setNewPoint] = useState(null);
  const [type, setType] = useState("theft");
  const [desc, setDesc] = useState("");

  const [counting, setCounting] = useState(false);
  const [count, setCount] = useState(5);
  const timerRef = useRef(null);

  const [ice, setIce] = useState({ blood: "", allergy: "", contactName: "", contactPhone: "" });

  useEffect(() => {
    const saved = localStorage.getItem("ice");
    if (saved) setIce(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  function submitReport(e) {
    e.preventDefault();
    if (!desc.trim()) {
      alert("add a short description first");
      return;
    }
    addDoc(collection(db, "reports"), {
      type,
      desc,
      lat: newPoint.lat,
      lng: newPoint.lng,
      time: serverTimestamp()
    });
    setNewPoint(null);
    setDesc("");
  }

  function startSOS() {
    setCounting(true);
    setCount(5);
    timerRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          fireSOS();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function cancelSOS() {
    clearInterval(timerRef.current);
    setCounting(false);
  }

  function fireSOS() {
    setCounting(false);
    if (!navigator.geolocation) {
      alert("location not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      addDoc(collection(db, "reports"), {
        type: "sos",
        desc: "SOS triggered" + (ice.contactName ? " - contact: " + ice.contactName : ""),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        time: serverTimestamp()
      });
    });
  }

  function saveIce(e) {
    e.preventDefault();
    localStorage.setItem("ice", JSON.stringify(ice));
    alert("saved");
  }

  return (
    <div className="container">
      <div className="topbar">
        <h2>Crime Map</h2>
        <div>
          <button onClick={() => setView("map")}>Map</button>
          <button onClick={() => setView("ice")}>Emergency Info</button>
        </div>
      </div>

      {view === "map" && (
        <>
          <MapContainer center={[25.4358, 81.8463]} zoom={13} style={{ height: "75vh" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickCatcher onClick={setNewPoint} />
            {reports.map((r) => (
              <Marker key={r.id} position={[r.lat, r.lng]}>
                <Popup>
                  <b>{r.type}</b>
                  <p>{r.desc}</p>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <p className="hint">click on the map to report something</p>

          {newPoint && (
            <form className="reportForm" onSubmit={submitReport}>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="theft">Theft</option>
                <option value="assault">Assault</option>
                <option value="accident">Accident</option>
                <option value="other">Other</option>
              </select>
              <input
                placeholder="what happened?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <button type="submit">Submit</button>
              <button type="button" onClick={() => setNewPoint(null)}>Cancel</button>
            </form>
          )}

          <div className="sosBox">
            {!counting ? (
              <button className="sosBtn" onClick={startSOS}>SOS</button>
            ) : (
              <div className="sosCount">
                sending in {count}...
                <button onClick={cancelSOS}>Cancel</button>
              </div>
            )}
          </div>
        </>
      )}

      {view === "ice" && (
        <form className="iceForm" onSubmit={saveIce}>
          <label>Blood group</label>
          <input value={ice.blood} onChange={(e) => setIce({ ...ice, blood: e.target.value })} />

          <label>Allergies</label>
          <input value={ice.allergy} onChange={(e) => setIce({ ...ice, allergy: e.target.value })} />

          <label>Emergency contact name</label>
          <input value={ice.contactName} onChange={(e) => setIce({ ...ice, contactName: e.target.value })} />

          <label>Emergency contact phone</label>
          <input value={ice.contactPhone} onChange={(e) => setIce({ ...ice, contactPhone: e.target.value })} />

          <button type="submit">Save</button>
        </form>
      )}
    </div>
  );
}