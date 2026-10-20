/**
 * A photo made ready to send from the phone: cut to a square around its
 * centre, at most `size` pixels a side, as a light JPEG (a few tens of KB
 * instead of several MB, which matters on a mobile connection). The browser
 * turns the picture the right way up from its camera data on its own.
 */
export async function squarePhoto(file: Blob, size = 512, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('Unreadable image');
    const out = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unreadable image');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Unreadable image');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
