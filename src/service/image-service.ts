import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "../lib/mysql";

const imageTypes = {
  "image/jpeg": {
    extension: "jpg",
    signature: (data: Buffer) =>
      data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (data: Buffer) =>
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  "image/gif": {
    extension: "gif",
    signature: (data: Buffer) =>
      data.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6)),
  },
  "image/webp": {
    extension: "webp",
    signature: (data: Buffer) =>
      data.length >= 12 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP",
  },
} as const;

type ImageType = keyof typeof imageTypes;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ImageRow = RowDataPacket & {
  id: string;
  title: string | null;
  place: string | null;
  note: string | null;
  created_at: Date | string;
};

type ImageFileRow = RowDataPacket & {
  storage_path: string;
  account_id: string;
};

export type GalleryImage = {
  id: string;
  title: string | null;
  place: string | null;
  note: string | null;
  created_at: string;
};

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ImageUploadError";
  }
}

function getStorageRoot() {
  const configuredPath = process.env.IMAGE_STORAGE_DIR?.trim();
  if (configuredPath === "") {
    throw new Error("IMAGE_STORAGE_DIR must not be empty.");
  }
  return path.resolve(
    /* turbopackIgnore: true */ configuredPath || "data/images",
  );
}

function detectImageType(buffer: Buffer): ImageType | null {
  for (const [mimeType, definition] of Object.entries(imageTypes)) {
    if (definition.signature(buffer)) return mimeType as ImageType;
  }
  return null;
}

function getImageDimensions(
  buffer: Buffer,
  type: ImageType,
): { width: number | null; height: number | null } {
  if (type === "image/png" && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (type === "image/gif" && buffer.length >= 10) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }
  if (type === "image/webp" && buffer.length >= 30) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: buffer.readUIntLE(24, 3) + 1,
        height: buffer.readUIntLE(27, 3) + 1,
      };
    }
    if (
      chunk === "VP8 " &&
      buffer[23] === 0x9d &&
      buffer[24] === 0x01 &&
      buffer[25] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && buffer[20] === 0x2f) {
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
      };
    }
  }
  if (type === "image/jpeg") {
    const frameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset + 3 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset];
      offset += 1;
      if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 1 >= buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (frameMarkers.has(marker) && segmentLength >= 7) {
        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += segmentLength;
    }
  }
  return { width: null, height: null };
}

function makeGalleryImage(row: ImageRow): GalleryImage {
  return {
    id: row.id,
    title: row.title,
    place: row.place,
    note: row.note,
    created_at: new Date(row.created_at).toISOString(),
  };
}

export async function listImages(accountId: string): Promise<GalleryImage[]> {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute<ImageRow[]>(
    `SELECT id, title, place, note, created_at
     FROM images
     WHERE account_id = ?
     ORDER BY created_at DESC`,
    [accountId],
  );
  return rows.map(makeGalleryImage);
}

export async function saveImage(
  accountId: string,
  file: File,
  details: { title: string | null; place: string | null; note: string | null },
): Promise<GalleryImage> {
  if (!uuidPattern.test(accountId)) {
    throw new Error("The authenticated account ID is invalid.");
  }

  const mimeType = file.type as ImageType;
  const definition = imageTypes[mimeType];
  if (!definition) {
    throw new ImageUploadError(
      "Choose a JPEG, PNG, GIF, or WebP image.",
      415,
    );
  }
  if (file.size === 0) {
    throw new ImageUploadError("The selected image is empty.", 400);
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new ImageUploadError("Images must be 10 MB or smaller.", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (detectImageType(buffer) !== mimeType) {
    throw new ImageUploadError(
      "The selected file does not match its image format.",
      415,
    );
  }

  const id = randomUUID();
  const fileName = `${id}.${definition.extension}`;
  const storagePath = `${accountId}/${fileName}`;
  const fullPath = path.join(
    /* turbopackIgnore: true */ getStorageRoot(),
    accountId,
    fileName,
  );
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer, { flag: "wx" });

  try {
    const pool = await getMysqlPool();
    const attributes = JSON.stringify({
      ...getImageDimensions(buffer, mimeType),
      size: buffer.byteLength,
      content_type: mimeType,
    });
    await pool.execute(
      `INSERT INTO images
         (id, account_id, storage_path, title, attributes, place, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        accountId,
        storagePath,
        details.title,
        attributes,
        details.place,
        details.note,
      ],
    );

    return {
      id,
      ...details,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    await unlink(fullPath);
    throw error;
  }
}

export async function readImage(
  accountId: string | null,
  id: string,
  publicToken?: string,
): Promise<{ buffer: Buffer; contentType: ImageType } | null> {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute<ImageFileRow[]>(
    `SELECT i.storage_path, i.account_id
     FROM images i
     WHERE i.id = ?
       AND (
         i.account_id = ?
         OR EXISTS (
           SELECT 1
           FROM album_images ai
           INNER JOIN album_shares ash ON ash.album_id = ai.album_id
           WHERE ai.image_id = i.id AND ash.account_id = ?
         )
         OR (
           ? IS NOT NULL AND EXISTS (
             SELECT 1
             FROM album_images ai
             INNER JOIN albums a ON a.id = ai.album_id
             WHERE ai.image_id = i.id AND a.public_token = ?
           )
         )
       )`,
    [id, accountId, accountId, publicToken ?? null, publicToken ?? null],
  );
  const row = rows[0];
  if (!row) return null;

  const storagePath = row.storage_path;
  if (
    (accountId !== null && !uuidPattern.test(accountId)) ||
    !uuidPattern.test(id)
  ) {
    throw new Error("The stored image identity is invalid.");
  }
  const extension = path.extname(storagePath).toLowerCase();
  const expectedFileName = `${id}${extension}`;
  const validExtension = Object.values(imageTypes).some(
    (definition) => `.${definition.extension}` === extension,
  );
  const storedPathParts = storagePath.split(/[\\/]/);
  const isAccountScopedPath =
    storedPathParts.length === 2 &&
    storedPathParts[0] === row.account_id &&
    storedPathParts[1] === expectedFileName;
  const isLegacyPath =
    storedPathParts.length === 1 && storedPathParts[0] === expectedFileName;
  if (!validExtension || (!isAccountScopedPath && !isLegacyPath)) {
    throw new Error("The stored image path is invalid.");
  }
  const contentType = Object.entries(imageTypes).find(
    ([, definition]) => `.${definition.extension}` === extension,
  )?.[0] as ImageType | undefined;
  if (!contentType) {
    throw new Error("The stored image format is invalid.");
  }

  const fullPath = path.join(
    /* turbopackIgnore: true */ getStorageRoot(),
    ...(isAccountScopedPath ? storedPathParts : [storedPathParts[0]]),
  );
  const buffer = await readFile(fullPath);
  return { buffer, contentType };
}
