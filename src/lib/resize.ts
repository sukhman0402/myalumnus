// Browser-side photo preparation (planning/02 D8): crop to the 3:4 frame the guard sees, keeping the upper part of
// the picture where faces usually are, and resize to 480 × 640 JPEG. Keeps uploads small and the bucket uniform.
export async function toGatePhoto(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const W = 480, H = 640;
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (bmp.width / bmp.height > W / H) { sw = Math.round(bmp.height * W / H); sx = Math.round((bmp.width - sw) / 2); }
  else { sh = Math.round(bmp.width * H / W); sy = Math.round((bmp.height - sh) * 0.3); }
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
}
