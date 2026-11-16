type QrImage = HTMLImageElement | HTMLVideoElement;
type NativeDetector = new (options: { formats: string[] }) => {
  detect(source: QrImage): Promise<{ rawValue: string }[]>;
};

const MAX_FRAME_EDGE = 1280;

export function createAttendanceQrReader() {
  const Detector = (window as Window & { BarcodeDetector?: NativeDetector }).BarcodeDetector;
  let detector: InstanceType<NativeDetector> | undefined;
  try {
    detector = Detector && new Detector({ formats: ["qr_code"] });
  } catch {
    // A browser may expose the API without supporting QR detection.
  }
  let context: CanvasRenderingContext2D | null | undefined;

  return async (source: QrImage): Promise<string | undefined> => {
    if (detector) {
      try {
        return (await detector.detect(source)).find(result => result.rawValue)?.rawValue;
      } catch {
        detector = undefined;
      }
    }

    const isVideo = source instanceof HTMLVideoElement;
    const width = isVideo ? source.videoWidth : source.naturalWidth;
    const height = isVideo ? source.videoHeight : source.naturalHeight;
    if (!width || !height) return;

    context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!context) throw Error("QR image processing is unavailable.");
    const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(width, height));
    const frameWidth = Math.max(1, Math.round(width * scale));
    const frameHeight = Math.max(1, Math.round(height * scale));
    if (context.canvas.width !== frameWidth) context.canvas.width = frameWidth;
    if (context.canvas.height !== frameHeight) context.canvas.height = frameHeight;
    const { default: decode } = await import("jsqr");
    context.drawImage(source, 0, 0, frameWidth, frameHeight);
    const frame = context.getImageData(0, 0, frameWidth, frameHeight);
    return decode(frame.data, frame.width, frame.height)?.data;
  };
}

export async function readAttendanceQrImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const token = await createAttendanceQrReader()(image);
    if (!token) throw Error("No QR code found. Use a clear image or copy the supervisor token.");
    return token;
  } finally {
    URL.revokeObjectURL(url);
  }
}
