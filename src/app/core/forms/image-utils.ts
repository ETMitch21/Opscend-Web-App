import { heicTo } from 'heic-to/csp';

export const FORM_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

function extension(value: string): string {
  const clean = value.split(/[?#]/, 1)[0] ?? value;
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : '';
}

export function isHeicFile(file: File | Blob, filename = ''): boolean {
  const mimeType = String(file.type ?? '').toLowerCase();
  return HEIC_MIME_TYPES.has(mimeType) || ['heic', 'heif'].includes(extension(filename));
}

export function isHeicDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(?:heic|heif)(?:-sequence)?[;,]/i.test(value);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((response) => {
    if (!response.ok) throw new Error('Unable to read HEIC image.');
    return response.blob();
  });
}

async function heicBlobToJpegBlob(blob: Blob): Promise<Blob> {
  const converted = await heicTo({
    blob,
    type: 'image/jpeg',
    quality: 0.86,
  });

  if (!(converted instanceof Blob)) {
    throw new Error('The HEIC photo could not be converted to JPEG.');
  }

  return converted;
}

async function imageBlobToCanvas(blob: Blob): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to decode converted image.'));
      element.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare image conversion.');
    context.drawImage(image, 0, 0);
    return { canvas, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Unable to encode converted image.')),
      'image/jpeg',
      quality,
    );
  });
}

async function reduceJpegToLimit(blob: Blob, maxBytes: number): Promise<Blob> {
  if (blob.size <= maxBytes) return blob;

  const decoded = await imageBlobToCanvas(blob);
  let width = decoded.width;
  let height = decoded.height;
  let canvas = decoded.canvas;

  for (const quality of [0.78, 0.68, 0.58]) {
    const candidate = await canvasToJpegBlob(canvas, quality);
    if (candidate.size <= maxBytes) return candidate;
  }

  // Very large iPhone/iPad photos can still exceed the limit after JPEG conversion.
  // Step the dimensions down while keeping enough resolution for repair documentation.
  for (const maxDimension of [3200, 2800, 2400, 2000]) {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    if (scale >= 1) continue;

    const nextWidth = Math.max(1, Math.round(width * scale));
    const nextHeight = Math.max(1, Math.round(height * scale));
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = nextWidth;
    nextCanvas.height = nextHeight;
    const context = nextCanvas.getContext('2d');
    if (!context) throw new Error('Unable to resize converted image.');
    context.drawImage(canvas, 0, 0, nextWidth, nextHeight);

    canvas = nextCanvas;
    width = nextWidth;
    height = nextHeight;

    for (const quality of [0.78, 0.68, 0.58]) {
      const candidate = await canvasToJpegBlob(canvas, quality);
      if (candidate.size <= maxBytes) return candidate;
    }
  }

  const maxMb = Math.round(maxBytes / (1024 * 1024));
  throw new Error(`The converted photo is still larger than ${maxMb} MB. Try a smaller photo.`);
}


export async function normalizeWebImageFile(file: File, maxBytes = 25 * 1024 * 1024): Promise<File> {
  if (!isHeicFile(file, file.name)) return file;

  const converted = await heicBlobToJpegBlob(file);
  const webSafe = await reduceJpegToLimit(converted, maxBytes);
  const jpegName = file.name.replace(/\.(?:heic|heif)$/i, '') + '.jpg';
  return new File([webSafe], jpegName, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

export async function formImageFileToDataUrl(file: File): Promise<string> {
  if (file.size > FORM_PHOTO_MAX_BYTES) {
    throw new Error('Photos must be 15 MB or smaller.');
  }

  const normalized = await normalizeWebImageFile(file, FORM_PHOTO_MAX_BYTES);
  return blobToDataUrl(normalized);
}

export async function heicDataUrlToJpegDataUrl(value: string): Promise<string> {
  if (!isHeicDataUrl(value)) return value;
  const source = await dataUrlToBlob(value);
  const converted = await heicBlobToJpegBlob(source);
  const webSafe = await reduceJpegToLimit(converted, FORM_PHOTO_MAX_BYTES);
  return blobToDataUrl(webSafe);
}
