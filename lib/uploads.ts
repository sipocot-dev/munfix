import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./errors";

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Identify the image type from its magic bytes (never trust the client's MIME type). */
function sniff(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}

/** Validates and stores images. Returns the stored file names. */
export async function saveImages(files: File[]): Promise<string[]> {
  if (files.length > MAX_FILES) throw new HttpError(400, `You can attach up to ${MAX_FILES} photos`);

  const prepared: { name: string; buf: Buffer }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new HttpError(400, "Each photo must be 5 MB or smaller");
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) throw new HttpError(400, "Photos must be JPEG, PNG or WebP images");
    prepared.push({ name: `${randomUUID()}.${ext}`, buf });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const written: string[] = [];
  try {
    for (const { name, buf } of prepared) {
      await writeFile(path.join(UPLOAD_DIR, name), buf, { flag: "wx" });
      written.push(name);
    }
  } catch (err) {
    await deleteImages(written);
    throw err;
  }
  return written;
}

export async function deleteImages(names: string[]): Promise<void> {
  await Promise.all(
    names
      .filter((n) => FILE_NAME_RE.test(n))
      .map((n) => unlink(path.join(UPLOAD_DIR, n)).catch(() => {})),
  );
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!FILE_NAME_RE.test(name)) return null;
  try {
    return await readFile(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}
