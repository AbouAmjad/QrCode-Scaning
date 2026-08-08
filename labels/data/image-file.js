/**
 * Read / compress a local image file for embedding in label templates.
 * Returns a data URL suitable for layer.src (print-safe, no network).
 */

/**
 * @param {File} file
 * @param {{ maxSide?: number, quality?: number }} [opts]
 * @returns {Promise<string>} data URL
 */
export async function fileToLabelImageDataUrl(file, opts = {}) {
  if (!file) throw new Error("No file selected");
  const type = String(file.type || "");
  if (!type.startsWith("image/")) throw new Error("Please choose an image file");

  if (type === "image/svg+xml") {
    const text = await file.text();
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }

  const maxSide = Math.max(64, Number(opts.maxSide) || 900);
  const quality = Math.min(0.95, Math.max(0.5, Number(opts.quality) || 0.82));

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h, 1));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  // Keep PNG when source is PNG (logos / transparency); JPEG otherwise.
  if (type === "image/png" || type === "image/webp") {
    return canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/jpeg", quality);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = src;
  });
}

/**
 * Open a native file picker for images.
 * @returns {Promise<File|null>}
 */
export function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml";
    input.style.display = "none";
    const done = (file) => {
      input.remove();
      resolve(file || null);
    };
    input.addEventListener("change", () => done(input.files?.[0] || null), { once: true });
    input.addEventListener("cancel", () => done(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
