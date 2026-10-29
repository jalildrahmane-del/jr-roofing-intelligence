import React, { useEffect, useRef, useState } from "react";
export function AttendanceScanner({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false),
    [message, setMessage] = useState("");
  const cleanup = () => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  const stop = () => {
    cleanup();
    setActive(false);
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        cleanup();
        setActive(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      cleanup();
    };
  }, []);
  async function start() {
    cleanup();
    const run = generation.current;
    setMessage("");
    setActive(true);
    try {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera QR scanning is unavailable. Use QR image import or paste the supervisor token.",
        );
      const detector = new Detector({ formats: ["qr_code"] });
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (run !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      const deadline = Date.now() + 60000;
      async function scan() {
        if (run !== generation.current) return;
        try {
          if (Date.now() > deadline)
            throw Error(
              "Scan timed out. Try again or paste the supervisor token.",
            );
          const found = await detector.detect(video.current);
          if (run !== generation.current) return;
          const token = found.find(
            (r: any) => typeof r.rawValue === "string" && r.rawValue.length > 0,
          )?.rawValue;
          if (token) {
            if (token.length > 4096)
              throw Error(
                "QR value is too long. Use the supervisor attendance code.",
              );
            onToken(token);
            stop();
            setMessage(
              "QR captured. Submit your GPS event for server validation.",
            );
            return;
          }
          timer.current = setTimeout(scan, 200);
        } catch (e) {
          if (run === generation.current) {
            stop();
            setMessage((e as Error).message);
          }
        }
      }
      if (run === generation.current) void scan();
    } catch (e) {
      if (run === generation.current) {
        stop();
        setMessage(
          (e as Error).message ||
            "Camera unavailable. Paste the supervisor token.",
        );
      }
    }
  }
  return (
    <section aria-label="Attendance camera scanner">
      <button disabled={active} onClick={start}>
        Scan supervisor QR with camera
      </button>
      {active && <button onClick={stop}>Stop camera</button>}
      <video
        ref={video}
        muted
        playsInline
        hidden={!active}
        style={{ width: "100%", maxWidth: 400 }}
        aria-label="QR camera preview"
      />
      <p role="status">{message}</p>
    </section>
  );
}
