# Photo Gallery

This is the photo-gallery project, built with Next.js, React, and Tailwind CSS.

## Features

- Authenticated accounts.
- An account-owned gallery with single-image uploads and optional title, place, and note.
- Image albums: create named albums, assign multiple images, edit them, and share view-only access with another account by email or anyone with a revocable public link.

## Run locally

Configure the database in `.env.local` (this file is ignored by Git):

```dotenv
MYSQL_HOST=http://localhost
MYSQL_PORT=3306
MYSQL_USER=your-user
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=photo-gallery
IMAGE_STORAGE_DIR=./data/images
AUTH_SECRET=generate-a-long-random-secret
AUTH_TRUST_HOST=true
```

Generate `AUTH_SECRET` with `npx auth secret`. Set `AUTH_TRUST_HOST=true` for local development. In production, enable it only when the app is reached through a host or reverse proxy you control that supplies the correct host headers.

`IMAGE_STORAGE_DIR` is a server-side filesystem directory, not exposed to the browser. Locally it defaults to `./data/images` under the project directory; Docker Compose sets it to `/app/data/images` and mounts a persistent named volume there. Keep image files out of `public`. Uploads accept JPEG, PNG, GIF, and WebP files up to 10 MB. Files are stored in an account-specific subdirectory using the image UUID as the filename (for example, `<IMAGE_STORAGE_DIR>/<account_id>/<image_uuid>.jpg`); this relative path and metadata are stored in MySQL. Image viewing is restricted to the owning account.

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for local development.

Run the checks and production build with:

```bash
npm run lint
npm run build
```

## Production Docker deployment

The Compose configuration reads the MySQL settings from `.env.local`; that file is ignored by Git and excluded from the Docker build context. Create it on the deployment host with the same database settings shown above, then build and start the production container:

```bash
docker compose -f docker-compose.yml up --build -d
```

The production site is served on port `3000` at [http://localhost:3000](http://localhost:3000). Check deployment status and logs with:

```bash
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs -f photo-gallery
```

The database host remains `127.0.0.1` inside the container, matching `.env.local`. Ensure the Docker host can route to that MySQL server and that MySQL allows connections from the Docker host. The app container does not include or start a MySQL server.

The MySQL user must be allowed to connect from the app host, create/alter tables, and drop the old resume tables when the database connection is first initialized. The app creates the configured database (if needed), the `account`, `images`, `albums`, `album_images`, and `album_shares` tables automatically. Each image and album belongs to one account; an image can be assigned to multiple albums. Album owners can rename albums, change assigned images, share view-only access with an existing account by email, or enable a public view-only URL that works without authentication. Public links use random tokens and can be disabled by the owner at any time. Deleting an account deletes its images, albums, and received shares. Image records store a storage path, optional title, place and note, JSON attributes (`width`, `height`, `size`, and `content_type`), and created/updated timestamps. The app adds the title and attributes columns to an existing `images` table when needed. It also drops the obsolete `resume_experiences` and `resume_drafts` tables, including their data.

The gallery requires an authenticated account; signed-out visitors are redirected to the login page. Password accounts require a password of at least 8 characters. Email verification and password recovery are not included.