import { randomBytes, randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "../lib/mysql";
import type { Album } from "../interface/album";

type AlbumRow = RowDataPacket & {
  id: string;
  name: string;
  created_at: Date | string;
  image_id: string | null;
  can_edit: number | boolean;
  owner_name: string | null;
};

type AlbumImageRow = RowDataPacket & {
  id: string;
  title: string | null;
  place: string | null;
  note: string | null;
  created_at: Date | string;
};

type AccountIdRow = RowDataPacket & {
  id: string;
};

export class AlbumServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AlbumServiceError";
  }
}

async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const pool = await getMysqlPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assertImagesBelongToAccount(
  connection: PoolConnection,
  accountId: string,
  imageIds: string[],
) {
  const uniqueIds = [...new Set(imageIds)];
  if (uniqueIds.length === 0) return uniqueIds;

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM images
     WHERE account_id = ? AND id IN (${placeholders})`,
    [accountId, ...uniqueIds],
  );
  if (rows.length !== uniqueIds.length) {
    throw new AlbumServiceError(
      "One or more selected images do not belong to your account.",
      400,
    );
  }
  return uniqueIds;
}

export async function listAlbums(accountId: string): Promise<Album[]> {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute<AlbumRow[]>(
    `SELECT a.id, a.name, a.created_at, ai.image_id, owner.name AS owner_name,
            (a.account_id = ?) AS can_edit
     FROM albums a
     INNER JOIN \`account\` owner ON owner.id = a.account_id
     LEFT JOIN album_images ai ON ai.album_id = a.id
     LEFT JOIN album_shares ash
       ON ash.album_id = a.id AND ash.account_id = ?
     WHERE a.account_id = ? OR ash.account_id IS NOT NULL
     ORDER BY a.created_at DESC, ai.image_id`,
    [accountId, accountId, accountId],
  );

  const albums = new Map<string, Album>();
  for (const row of rows) {
    let album = albums.get(row.id);
    if (!album) {
      album = {
        id: row.id,
        name: row.name,
        image_ids: [],
        created_at: new Date(row.created_at).toISOString(),
        can_edit: Boolean(row.can_edit),
        owner_name: row.owner_name,
      };
      albums.set(row.id, album);
    }
    if (row.image_id) album.image_ids.push(row.image_id);
  }
  return [...albums.values()];
}

export async function getAlbumImages(accountId: string, albumId: string) {
  const pool = await getMysqlPool();
  const [albumRows] = await pool.execute<AlbumRow[]>(
    `SELECT a.id, a.name, a.created_at, NULL AS image_id,
            owner.name AS owner_name,
            (a.account_id = ?) AS can_edit
     FROM albums a
     INNER JOIN \`account\` owner ON owner.id = a.account_id
     LEFT JOIN album_shares ash
       ON ash.album_id = a.id AND ash.account_id = ?
     WHERE a.id = ? AND (a.account_id = ? OR ash.account_id IS NOT NULL)`,
    [accountId, accountId, albumId, accountId],
  );
  const albumRow = albumRows[0];
  if (!albumRow) {
    throw new AlbumServiceError("Album not found.", 404);
  }

  const [imageRows] = await pool.execute<AlbumImageRow[]>(
    `SELECT i.id, i.title, i.place, i.note, i.created_at
     FROM images i
     INNER JOIN album_images ai ON ai.image_id = i.id
     WHERE ai.album_id = ?
     ORDER BY i.created_at DESC`,
    [albumId],
  );
  return {
    album: {
      id: albumRow.id,
      name: albumRow.name,
      image_ids: imageRows.map((image) => image.id),
      created_at: new Date(albumRow.created_at).toISOString(),
      can_edit: Boolean(albumRow.can_edit),
      owner_name: albumRow.owner_name,
    },
    images: imageRows.map((image) => ({
      id: image.id,
      title: image.title,
      place: image.place,
      note: image.note,
      created_at: new Date(image.created_at).toISOString(),
    })),
  };
}

export async function createAlbum(
  accountId: string,
  name: string,
  imageIds: string[],
): Promise<Album> {
  const id = randomUUID();
  return withTransaction(async (connection) => {
    const uniqueIds = await assertImagesBelongToAccount(
      connection,
      accountId,
      imageIds,
    );
    await connection.execute(
      "INSERT INTO albums (id, account_id, name) VALUES (?, ?, ?)",
      [id, accountId, name],
    );
    if (uniqueIds.length > 0) {
      await connection.query(
        `INSERT INTO album_images (album_id, image_id)
         VALUES ${uniqueIds.map(() => "(?, ?)").join(", ")}`,
        uniqueIds.flatMap((imageId) => [id, imageId]),
      );
    }
    return {
      id,
      name,
      image_ids: uniqueIds,
      created_at: new Date().toISOString(),
      can_edit: true,
      owner_name: null,
    };
  });
}

export async function updateAlbumImages(
  accountId: string,
  albumId: string,
  name: string,
  imageIds: string[],
): Promise<Album> {
  return withTransaction(async (connection) => {
    const [albumRows] = await connection.execute<AlbumRow[]>(
      `SELECT id, name, created_at, NULL AS image_id, 1 AS can_edit,
              NULL AS owner_name
       FROM albums
       WHERE id = ? AND account_id = ?
       FOR UPDATE`,
      [albumId, accountId],
    );
    const albumRow = albumRows[0];
    if (!albumRow) {
      throw new AlbumServiceError("Album not found.", 404);
    }

    const uniqueIds = await assertImagesBelongToAccount(
      connection,
      accountId,
      imageIds,
    );
    await connection.execute(
      "UPDATE albums SET name = ? WHERE id = ? AND account_id = ?",
      [name, albumId, accountId],
    );
    await connection.execute("DELETE FROM album_images WHERE album_id = ?", [
      albumId,
    ]);
    if (uniqueIds.length > 0) {
      await connection.query(
        `INSERT INTO album_images (album_id, image_id)
         VALUES ${uniqueIds.map(() => "(?, ?)").join(", ")}`,
        uniqueIds.flatMap((imageId) => [albumId, imageId]),
      );
    }
    return {
      id: albumRow.id,
      name,
      image_ids: uniqueIds,
      created_at: new Date(albumRow.created_at).toISOString(),
      can_edit: true,
      owner_name: null,
    };
  });
}

export async function shareAlbum(
  accountId: string,
  albumId: string,
  recipientEmail: string,
) {
  const pool = await getMysqlPool();
  const [albumRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM albums WHERE id = ? AND account_id = ?",
    [albumId, accountId],
  );
  if (albumRows.length === 0) {
    throw new AlbumServiceError("Album not found.", 404);
  }

  const [recipientRows] = await pool.execute<AccountIdRow[]>(
    "SELECT id FROM `account` WHERE email = ?",
    [recipientEmail],
  );
  const recipient = recipientRows[0];
  if (!recipient) {
    throw new AlbumServiceError("No account was found with that email.", 404);
  }
  if (recipient.id === accountId) {
    throw new AlbumServiceError("You already own this album.", 400);
  }

  await pool.execute(
    `INSERT INTO album_shares (album_id, account_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE account_id = VALUES(account_id)`,
    [albumId, recipient.id],
  );
  return { email: recipientEmail };
}

export async function getAlbumPublicLink(accountId: string, albumId: string) {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT public_token FROM albums WHERE id = ? AND account_id = ?",
    [albumId, accountId],
  );
  const album = rows[0];
  if (!album) {
    throw new AlbumServiceError("Album not found.", 404);
  }
  return { token: album.public_token as string | null };
}

export async function enableAlbumPublicLink(
  accountId: string,
  albumId: string,
) {
  const pool = await getMysqlPool();
  const token = randomBytes(32).toString("hex");
  await pool.execute(
    `UPDATE albums SET public_token = COALESCE(public_token, ?)
     WHERE id = ? AND account_id = ?`,
    [token, albumId, accountId],
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT public_token FROM albums WHERE id = ? AND account_id = ?",
    [albumId, accountId],
  );
  const album = rows[0];
  if (!album) {
    throw new AlbumServiceError("Album not found.", 404);
  }
  return { token: album.public_token as string };
}

export async function revokeAlbumPublicLink(
  accountId: string,
  albumId: string,
) {
  const pool = await getMysqlPool();
  const [result] = await pool.execute(
    "UPDATE albums SET public_token = NULL WHERE id = ? AND account_id = ?",
    [albumId, accountId],
  );
  if ("affectedRows" in result && result.affectedRows === 0) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM albums WHERE id = ? AND account_id = ?",
      [albumId, accountId],
    );
    if (rows.length === 0) {
      throw new AlbumServiceError("Album not found.", 404);
    }
  }
}

export async function getPublicAlbum(token: string) {
  const pool = await getMysqlPool();
  const [albumRows] = await pool.execute<AlbumRow[]>(
    `SELECT a.id, a.name, a.created_at, NULL AS image_id,
            owner.name AS owner_name, 0 AS can_edit
     FROM albums a
     INNER JOIN \`account\` owner ON owner.id = a.account_id
     WHERE a.public_token = ?`,
    [token],
  );
  const albumRow = albumRows[0];
  if (!albumRow) {
    throw new AlbumServiceError("Public album not found.", 404);
  }

  const [imageRows] = await pool.execute<AlbumImageRow[]>(
    `SELECT i.id, i.title, i.place, i.note, i.created_at
     FROM images i
     INNER JOIN album_images ai ON ai.image_id = i.id
     WHERE ai.album_id = ?
     ORDER BY i.created_at DESC`,
    [albumRow.id],
  );
  return {
    album: {
      id: albumRow.id,
      name: albumRow.name,
      image_ids: imageRows.map((image) => image.id),
      created_at: new Date(albumRow.created_at).toISOString(),
      can_edit: false,
      owner_name: albumRow.owner_name,
    },
    images: imageRows.map((image) => ({
      id: image.id,
      title: image.title,
      place: image.place,
      note: image.note,
      created_at: new Date(image.created_at).toISOString(),
    })),
  };
}
