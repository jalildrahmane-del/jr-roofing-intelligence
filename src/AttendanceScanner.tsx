import { useEffect, useRef, useState } from "react";

// A scan only fills the token field. The server still validates and reviews attendance.
export function AttendanceScanner({ onToken }: { onToken: (token: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cancel = useRef<() => void>(() => {});
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel.current(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); cancel.current(); };
  }, []);
  async function start() {
    cancel.current();
    const Detector = (window as any).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera QR reading is unavailable. Use a QR image or copy the supervisor token instead.");
      return;
    }
    let stopped = false;
    let stream: MediaStream | undefined;
    let next: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(deadline); clearTimeout(next);
      stream?.getTracks().forEach(track => track.stop());
      if (video.current) video.current.srcObject = null;
      setActive(false);
    };
    // Independent deadline also covers a stalled permission prompt or detector.
    const deadline = setTimeout(() => {
      stop(); setMessage("Camera scan timed out. Try again or copy the supervisor token.");
    }, 60_000);
    cancel.current = stop;
    setActive(true); setMessage("Starting camera…");
    try {
      const detector = new Detector({ formats: ["qr_code"] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
      const target = video.current;
      if (!target) { stop(); return; }
      target.srcObject = stream;
      await target.play();
      if (stopped) return;
      setMessage("Point the camera at the supervisor attendance QR.");
      const scan = async () => {
        try {
          const results = await detector.detect(target);
          if (stopped) return;
          const token = results.find((result: { rawValue?: string }) => typeof result.rawValue === "string" && result.rawValue.length > 0)?.rawValue;
          if (token) {
            if (token.length > 4096) throw Error("QR content is too long. Use the supervisor attendance token.");
            stop(); onToken(token); setMessage("Token captured. Confirm the project and submit the event for review.");
          } else next = setTimeout(scan, 200);
        } catch { if (!stopped) { stop(); setMessage("Unable to read camera QR. Try again or copy the supervisor token."); } }
      };
      void scan();
    } catch {
      if (!stopped) { stop(); setMessage("Camera could not start. Check camera permission or copy the supervisor token."); }
    }
  }
  return <div>
    <button type="button" disabled={active} onClick={start}>Scan supervisor QR with camera</button>
    {active && <button type="button" onClick={() => { cancel.current(); setMessage("Camera stopped."); }}>Cancel camera scan</button>}
    <video ref={video} hidden={!active} muted playsInline aria-label="Supervisor QR camera preview" style={{ width: "100%", maxWidth: 400 }} />
    {message && <p role="status">{message}</p>}
  </div>;
}
