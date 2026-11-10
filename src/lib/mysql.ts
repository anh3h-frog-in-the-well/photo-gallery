import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

type ColumnRow = RowDataPacket & {
  COLUMN_NAME: string;
};

type IndexRow = RowDataPacket & {
  INDEX_NAME: string;
};

const globalForMysql = globalThis as typeof globalThis & {
  mysqlPoolPromise?: Promise<Pool>;
};


function getDatabaseConfig() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  const port = Number(process.env.MYSQL_PORT ?? "3306");

  if (!host || !user || !password || !database) {
    throw new Error(
      "MySQL configuration is incomplete. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.",
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be a valid TCP port.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(database)) {
    throw new Error("MYSQL_DATABASE contains invalid characters.");
  }

  return { host, user, password, database, port };
}

async function createPool(): Promise<Pool> {
  const config = getDatabaseConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: "utf8mb4",
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }

  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
  });

  try {
    await pool.query(`
      DROP TABLE IF EXISTS resume_experiences
    `);
    await pool.query(`
      DROP TABLE IF EXISTS resume_drafts
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`account\` (
        id CHAR(36) NOT NULL PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS images (
        id CHAR(36) NOT NULL PRIMARY KEY,
        account_id CHAR(36) NOT NULL,
        storage_path VARCHAR(1024) NOT NULL,
        title VARCHAR(255) NULL,
        attributes JSON NULL,
        place VARCHAR(255) NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_images_account_created_at (account_id, created_at),
        CONSTRAINT fk_images_account
          FOREIGN KEY (account_id) REFERENCES \`account\`(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS albums (
        id CHAR(36) NOT NULL PRIMARY KEY,
        account_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        public_token CHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_albums_public_token (public_token),
        INDEX idx_albums_account_created_at (account_id, created_at),
        CONSTRAINT fk_albums_account
          FOREIGN KEY (account_id) REFERENCES \`account\`(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_images (
        album_id CHAR(36) NOT NULL,
        image_id CHAR(36) NOT NULL,
        PRIMARY KEY (album_id, image_id),
        INDEX idx_album_images_image_id (image_id),
        CONSTRAINT fk_album_images_album
          FOREIGN KEY (album_id) REFERENCES albums(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_album_images_image
          FOREIGN KEY (image_id) REFERENCES images(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_shares (
        album_id CHAR(36) NOT NULL,
        account_id CHAR(36) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (album_id, account_id),
        INDEX idx_album_shares_account_id (account_id),
        CONSTRAINT fk_album_shares_album
          FOREIGN KEY (album_id) REFERENCES albums(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_album_shares_account
          FOREIGN KEY (account_id) REFERENCES \`account\`(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    await pool.end();
    throw error;
  }

  return pool;
}

export function getMysqlPool(): Promise<Pool> {
  if (!globalForMysql.mysqlPoolPromise) {
    const poolPromise = createPool();
    globalForMysql.mysqlPoolPromise = poolPromise;
    void poolPromise.catch(() => {
      if (globalForMysql.mysqlPoolPromise === poolPromise) {
        delete globalForMysql.mysqlPoolPromise;
      }
    });
  }
  return globalForMysql.mysqlPoolPromise;
}
