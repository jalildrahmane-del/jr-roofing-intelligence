// ImageBitmap is not available in every mobile browser or embedded iOS WebView.
// Fall back to an HTML image without changing the output format or size limits.
async function loadPhoto(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Some supported image formats fail ImageBitmap decoding on particular devices.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    if (typeof image.decode === "function") await image.decode();
    else await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("Unable to read photograph"));
      if (image.complete) image.naturalWidth ? resolve() : reject(Error("Unable to read photograph"));
    });
    if (!image.naturalWidth || !image.naturalHeight) throw Error("Unable to read photograph");
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function prepareSitePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024)
    throw Error("Choose a JPEG, PNG or WebP photograph under 20 MiB");
  const photo = await loadPhoto(file);
  try {
    const scale = Math.min(1, 1600 / photo.width, 1600 / photo.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(photo.width * scale));
    canvas.height = Math.max(1, Math.round(photo.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error("Image processing unavailable");
    context.drawImage(photo.source, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.7);
    if (result.length > 1400000) throw Error("Compressed photograph too large. Choose a smaller photograph.");
    return result;
  } finally {
    photo.release();
  }
}
