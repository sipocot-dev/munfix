import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./errors";

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/* ----------------------------- Storage drivers ----------------------------- */

/**
 * Photos are always served through /api/v1/media/:name so the visibility rules
 * (unpublished reports are private) apply no matter where the bytes live.
 */
interface Store {
  put(name: string, data: Buffer, contentType: string): Promise<void>;
  get(name: string): Promise<Buffer | null>;
  remove(name: string): Promise<void>;
}

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

const localStore: Store = {
  async put(name, data) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), data, { flag: "wx" });
  },
  async get(name) {
    try {
      return await readFile(path.join(UPLOAD_DIR, name));
    } catch {
      return null;
    }
  },
  async remove(name) {
    await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
  },
};

/** Any S3-compatible service: AWS S3, Cloudflare R2, MinIO, Backblaze B2, ... */
function createS3Store(): Store {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET");
  const prefix = (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
  const keyOf = (name: string) => (prefix ? `${prefix}/${name}` : name);

  let clientPromise: Promise<{
    client: import("@aws-sdk/client-s3").S3Client;
    sdk: typeof import("@aws-sdk/client-s3");
  }> | null = null;

  // Loaded lazily so deployments using local storage never load the SDK.
  const getClient = () =>
    (clientPromise ??= import("@aws-sdk/client-s3").then((sdk) => {
      const accessKeyId = process.env.S3_ACCESS_KEY_ID;
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
      return {
        sdk,
        client: new sdk.S3Client({
          region: process.env.S3_REGION ?? "auto",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
          // The SDK's newer default checksums are rejected by some S3-compatible services.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
          // Without explicit keys the SDK falls back to its default credential chain (IAM roles, etc.).
          credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
        }),
      };
    }));

  return {
    async put(name, data, contentType) {
      const { client, sdk } = await getClient();
      await client.send(
        new sdk.PutObjectCommand({ Bucket: bucket, Key: keyOf(name), Body: data, ContentType: contentType }),
      );
    },
    async get(name) {
      const { client, sdk } = await getClient();
      try {
        const res = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: keyOf(name) }));
        return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    async remove(name) {
      const { client, sdk } = await getClient();
      await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: keyOf(name) })).catch(() => {});
    },
  };
}

let store: Store | null = null;
function getStore(): Store {
  if (store) return store;
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "s3") store = createS3Store();
  else if (driver === "local") store = localStore;
  else throw new Error(`Unknown STORAGE_DRIVER "${driver}" (expected "local" or "s3")`);
  return store;
}

/* ----------------------------- Public API ----------------------------- */

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

  const prepared: { name: string; buf: Buffer; type: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new HttpError(400, "Each photo must be 5 MB or smaller");
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) throw new HttpError(400, "Photos must be JPEG, PNG or WebP images");
    prepared.push({ name: `${randomUUID()}.${ext}`, buf, type: CONTENT_TYPES[ext] });
  }
  if (prepared.length === 0) return [];

  const s = getStore();
  const written: string[] = [];
  try {
    for (const { name, buf, type } of prepared) {
      await s.put(name, buf, type);
      written.push(name);
    }
  } catch (err) {
    await deleteImages(written);
    console.error("[uploads] storing photos failed:", err);
    throw new HttpError(502, "Could not store your photos. Please try again.");
  }
  return written;
}

export async function deleteImages(names: string[]): Promise<void> {
  const s = getStore();
  await Promise.all(names.filter((n) => FILE_NAME_RE.test(n)).map((n) => s.remove(n)));
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!FILE_NAME_RE.test(name)) return null;
  return getStore().get(name);
}
