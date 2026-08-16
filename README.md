# EduCMS

A role-based Content Management System built for the GoMyCode "Content Management System" checkpoint. Editors and authors write and publish articles, admins manage users and roles, and readers browse and comment - all backed by a relational PostgreSQL schema with a Redis caching layer.

## Features

- **JWT authentication** with bcrypt-hashed passwords.
- **Role-based access control** with four roles - Admin, Editor, Author, Subscriber - each with a strict permission tier enforced on the server (never trusted from the client):
  - Subscribers can read published articles and post comments (held for moderation).
  - Authors can write and edit their own posts; submitting as "published" is automatically downgraded to "pending" review.
  - Editors can publish/archive any post, manage categories and tags, and moderate comments.
  - Admins can additionally manage user accounts and promote/demote roles.
- **Posts** with categories, tags, SEO fields (title/description/keywords), featured images, view counts, and full CRUD.
- **Threaded comments** with a moderation queue (pending/approved/spam/trash).
- **Media library** for image uploads (Multer, validated by MIME type and size).
- **Activity log** - every create/update/delete/publish/moderate action is recorded with the acting user, entity and timestamp for auditing.
- **Redis caching** in front of the published-posts listing, with automatic graceful fallback to PostgreSQL if Redis is unreachable.
- **React + Material-UI** admin dashboard (post editor, category manager, comment moderation, user role management) plus a public reading experience.

## Tech stack

- Backend: Node.js, Express, PostgreSQL (`pg`), Redis, JWT, bcryptjs, Multer, Winston.
- Frontend: React 18, Vite, Material-UI, React Router, Axios.
- Database: PostgreSQL with a full relational schema (`database/schema.sql`) - users, categories, posts, tags, post_tags, comments, media, activity_log - including indexes, `updated_at` triggers, and two convenience views (`published_posts_view`, `post_comment_counts_view`).

## Project structure

```
educms-cms-checkpoint/
├── database/
│   └── schema.sql          # Tables, types, indexes, triggers, views, seed data
├── backend/
│   ├── src/
│   │   ├── config/         # database.js (pg Pool), redis.js (cache helpers)
│   │   ├── middleware/     # auth.js (JWT + RBAC), upload.js (Multer)
│   │   ├── models/         # One file per table, plain SQL via pg
│   │   ├── routes/         # auth, users, categories, tags, posts, comments, media
│   │   ├── utils/          # logger (winston), helpers (pagination/slugify), auth (JWT sign/verify)
│   │   └── server.js       # Express app wiring; exports { app } for testing
│   ├── demo/run-demo.js    # End-to-end verification script (see below)
│   └── scripts/migrate.js  # Applies database/schema.sql
└── frontend/
    └── src/
        ├── api/client.js           # Axios instance + JWT interceptor
        ├── context/AuthContext.jsx # login/register/logout + role helpers
        ├── components/             # NavBar, ProtectedRoute
        └── pages/
            ├── Login.jsx, Register.jsx
            ├── PublicHome.jsx, PublicPost.jsx   # Public reading + commenting
            └── admin/
                ├── PostList.jsx, PostEditor.jsx  # Author+
                ├── Categories.jsx, Comments.jsx  # Editor+
                └── Users.jsx                     # Admin only
```

## Running it for real

**Backend**

```bash
cd backend
cp .env.example .env        # then fill in your PostgreSQL/Redis/JWT settings
npm install
createdb educms             # or use any PostgreSQL instance
npm run migrate             # applies database/schema.sql (tables + seed data)
npm run dev                 # http://localhost:5000
```

**Frontend**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:3000, proxies /api to the backend
```

Redis is optional in development - if `REDIS_URL` is unset or unreachable, every caching call fails soft and the app reads straight from PostgreSQL.

## Verifying it works

This project was developed and verified against a **real, running PostgreSQL database and a real Redis instance** - `backend/demo/run-demo.js` is not a mocked unit test, it boots the actual Express app (`src/server.js`) and drives it over real HTTP requests, using the actual `pg` connection pool and the actual Redis client:

1. Connectivity check against both PostgreSQL and Redis.
2. Import-chain smoke test for every model/route/middleware file.
3. Registration + login, confirming bcrypt hashing and JWT issuance/verification round-trip through the real `/api/auth` routes.
4. Role-based access control: a subscriber is rejected (403) from creating posts; an author is rejected from managing categories; an editor succeeds - each check hits the real `requireRole` middleware.
5. Post lifecycle: an author-submitted "published" post is server-side downgraded to "pending" (never trusting client input for permissions), an editor publishes it, and the public endpoint then serves it while incrementing `view_count` on each read.
6. Comment moderation: a subscriber's comment lands as "pending", an editor's comment auto-approves, and the public comment list only ever exposes approved comments.
7. Activity log: post creation and the publish action both produce audit rows.
8. Redis caching: the published-posts listing is verified consistent across repeated requests, with an explicit fallback path if Redis is down.

All rows the script creates are prefixed `__demo__` and deleted at the end, so it's safe to run repeatedly against a real database:

```bash
cd backend
npm run demo
```

`output.txt` in the project root is a captured run of `npm run demo` showing every step passing end-to-end against a live PostgreSQL + Redis stack.

## Deploying

- **Database**: any managed PostgreSQL (e.g. Render, Railway, Heroku Postgres, RDS) - run `database/schema.sql` once against it.
- **Cache**: any managed Redis (e.g. Upstash, Redis Cloud) - optional, the app runs without it.
- **Backend**: deploy `backend/` as a standard Node service; set `PG*`, `REDIS_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` as environment variables.
- **Frontend**: `npm run build` in `frontend/` and serve the `dist/` folder as a static site (Vercel, Netlify, or any static host), with `VITE_API_URL` pointed at the deployed backend.
