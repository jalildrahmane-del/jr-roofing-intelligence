import React, { useState } from "react";
import { measureRoofPlan, type PlanPoint } from "./roof-plan-geometry.ts";
import "./roof-plan-drawing.css";
import type { SavedRoofPlan } from "./roof-plan-record.ts";

/** Standalone preliminary plan sketch; deliberately does not modify approved survey measurements. */
export function RoofPlanDrawing({ saved, onSave }: { saved?: SavedRoofPlan | null; onSave?: (plan: SavedRoofPlan, image?: string) => Promise<void> }) {
  const [vertices, setVertices] = useState<PlanPoint[]>(saved?.vertices ?? []);
  const [calibrationPoints, setCalibrationPoints] = useState<PlanPoint[]>(saved?.calibrationPoints ?? []);
  const [mode, setMode] = useState<"boundary" | "calibration">("boundary");
  const [distance, setDistance] = useState(saved ? String(saved.actualDistanceMetres) : "");
  const [pitch, setPitch] = useState(saved?.pitchDegrees == null ? "" : String(saved.pitchDegrees));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState(saved?.imageAssetId ? "Saved roof image" : "");
  const [result, setResult] = useState<ReturnType<typeof measureRoofPlan> | null>(null);
  const points = vertices.map(p => `${p.x},${p.y}`).join(" ");
  function addPoint(event: React.MouseEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(1000, (event.clientX - bounds.left) * 1000 / bounds.width));
    const y = Math.max(0, Math.min(600, (event.clientY - bounds.top) * 600 / bounds.height));
    const point = { x, y };
    if (mode === "boundary") setVertices(previous => previous.length < 500 ? [...previous, point] : previous);
    else setCalibrationPoints(previous => previous.length === 2 ? [point] : [...previous, point]);
    setResult(null);
    setError("");
  }
  async function loadImage(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 1024 * 1024) {
      setError("Select a PNG or JPEG image no larger than 1 MiB."); return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(Error("Cannot read image"));
        reader.onerror = () => reject(Error("Cannot read image"));
        reader.readAsDataURL(file);
      });
      setImageData(data); setImageName(file.name); setVertices([]); setCalibrationPoints([]);
      setResult(null); setError("");
    } catch (err) { setError((err as Error).message); }
  }
  function calculate() {
    try {
      if (calibrationPoints.length !== 2 || !distance.trim() || !Number.isFinite(Number(distance)) || Number(distance) <= 0) {
        throw Error("Set two calibration points and enter a verified positive distance.");
      }
      if (pitch.trim() && (!Number.isFinite(Number(pitch)) || Number(pitch) < 0 || Number(pitch) >= 90)) {
        throw Error("Pitch must be between 0 and less than 90 degrees.");
      }
      setResult(measureRoofPlan(vertices, {
        pointA: calibrationPoints[0], pointB: calibrationPoints[1], actualDistanceMetres: Number(distance),
      }, pitch.trim() ? Number(pitch) : undefined));
      setError("");
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    }
  }
  return <section className="roof-plan-drawing">
    <h2>Roof plan sketch — preliminary measurement</h2>
    <p>Upload a roof plan or aerial image (PNG or JPEG, maximum 1 MiB), then click or tap to trace the roof boundary. Mark two calibration points against an independently verified dimension. This is a local preview, not a georeferenced map.</p>
    <label>Background roof image (local preview only)
      <input type="file" accept="image/png,image/jpeg" onChange={e => void loadImage(e.target.files?.[0])} />
    </label>
    {(imageData || saved?.imageAssetId) && <p role="status">Image: {imageName || "Saved roof image"}. The image is stored with the roof plan when you save the revision.</p>}
    {imageData && <button type="button" className="quiet" onClick={() => {setImageData(null);setImageName("");setVertices([]);setCalibrationPoints([]);setResult(null);}}>Remove background and clear tracing</button>}
    <div className="roof-plan-actions">
      <button type="button" aria-pressed={mode === "boundary"} onClick={() => setMode("boundary")}>1. Draw boundary</button>
      <button type="button" aria-pressed={mode === "calibration"} onClick={() => setMode("calibration")}>2. Mark calibration</button>
      <button type="button" className="quiet" onClick={() => { setVertices(p => p.slice(0,-1)); setResult(null); }}>Undo boundary point</button>
      <button type="button" className="quiet" onClick={() => { setVertices([]); setCalibrationPoints([]); setResult(null); setError(""); }}>Clear sketch</button>
    </div>
    <p aria-live="polite">Mode: {mode === "boundary" ? "roof boundary" : "calibration"} · {vertices.length} boundary points · {calibrationPoints.length}/2 calibration points</p>
    <svg role="img" aria-label="Interactive roof plan sketch: click or tap to add points" viewBox="0 0 1000 600" onClick={addPoint}>
      <title>Preliminary roof plan sketch</title>
      <rect width="1000" height="600" fill="#f5f7fa" />
      {(imageData || saved?.imageAssetId) && <image href={imageData || `/api/evidence/${saved?.imageAssetId}`} x="0" y="0" width="1000" height="600" preserveAspectRatio="xMidYMid meet" /> }
      {!imageData && !saved?.imageAssetId && Array.from({length:19},(_,i)=><line key={`v${i}`} x1={(i+1)*50} x2={(i+1)*50} y1="0" y2="600" stroke="#dce2e9"/>)}
      {!imageData && !saved?.imageAssetId && Array.from({length:11},(_,i)=><line key={`h${i}`} x1="0" x2="1000" y1={(i+1)*50} y2={(i+1)*50} stroke="#dce2e9"/>)}
      {vertices.length >= 3 && <polygon points={points} fill="#d6e6f2" fillOpacity=".65" stroke="#304b6b" strokeWidth="3"/>}
      {vertices.length === 2 && <polyline points={points} fill="none" stroke="#304b6b" strokeWidth="3"/>}
      {vertices.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="7" fill="#304b6b"/>)}
      {calibrationPoints.length === 2 && <line x1={calibrationPoints[0].x} y1={calibrationPoints[0].y} x2={calibrationPoints[1].x} y2={calibrationPoints[1].y} stroke="#c07d15" strokeWidth="4" strokeDasharray="12 7"/>}
      {calibrationPoints.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="9" fill="#c07d15"/>)}
    </svg>
    <div className="fields">
      <label>Verified calibration distance (metres)<input type="number" min="0.001" step="any" value={distance} onChange={e=>{setDistance(e.target.value);setResult(null);}} placeholder="e.g. 10" /></label>
      <label>Roof pitch (degrees, optional)<input type="number" min="0" max="89.99" step="any" value={pitch} onChange={e=>{setPitch(e.target.value);setResult(null);}} placeholder="e.g. 5" /></label>
    </div>
    <button type="button" onClick={calculate}>Calculate preliminary measurements</button>
    {onSave && <button type="button" disabled={!result || saving} onClick={async () => {
      if (!result || calibrationPoints.length !== 2) return;
      setSaving(true); setError("");
      try { await onSave({ vertices, calibrationPoints: [calibrationPoints[0], calibrationPoints[1]],
        actualDistanceMetres: Number(distance), pitchDegrees: pitch.trim() ? Number(pitch) : null,
        status: "preliminary-unverified", ...(saved?.imageAssetId && !imageData ? {imageAssetId: saved.imageAssetId} : {}) }, imageData ?? undefined); }
      catch (err) { setError((err as Error).message); }
      finally { setSaving(false); }
    }}>{saving ? "Saving…" : "Save preliminary roof plan revision"}</button>}
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div role="status" className="roof-plan-results">
      <strong>Preliminary / unverified — not an approved survey</strong>
      <p>Plan area: {result.planAreaM2.toFixed(2)} m² · Perimeter: {result.perimeterM.toFixed(2)} m</p>
      <p>Pitch-adjusted surface area: {result.surfaceAreaM2 === null ? "Pitch not provided" : result.surfaceAreaM2.toFixed(2) + " m²"}</p>
      <p>The plan can be saved as preliminary evidence but is not used in estimating or as the approved survey area. Verify dimensions and roof geometry independently.</p>
    </div>}
  </section>;
}
