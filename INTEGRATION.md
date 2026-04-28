# HabitPulse Integration Guide

This project already connects frontend, backend, auth, and saved user data. The flow is:

```text
Browser UI -> Express API -> Prisma -> SQLite database
```

## 1. Local Setup

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
copy .env.example .env
```

Create the database tables:

```bash
npm run db:push
```

Add demo data:

```bash
npm run seed
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 2. How Saved User Data Works

Every protected API route uses the login cookie to identify the current user.

- `User` stores account identity.
- `Habit` stores each user's habit definitions.
- `HabitLog` stores daily check-ins.
- `Goal` stores daily, monthly, and yearly goals.

The backend never trusts the browser to choose a user id. It always uses `req.user.id` from the verified session.

## 3. Email Login

Email login is already implemented:

- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Current session: `GET /api/auth/me`
- Logout: `POST /api/auth/logout`

Passwords are hashed with bcrypt before they are stored.

## 4. Google Login

Create a Google OAuth Client ID in Google Cloud Console.

Authorized redirect URI:

```text
http://localhost:3000/api/auth/google/callback
```

Add these values to `.env`:

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
```

Restart the server. The Google button will automatically become active.

## 5. Production Upgrade Path

For a serious public launch, use PostgreSQL instead of SQLite.

1. Create a PostgreSQL database on Railway, Render, Supabase, Neon, or AWS RDS.
2. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
3. Set `DATABASE_URL` to your hosted PostgreSQL connection string.
4. Run:

```bash
npm run db:migrate
npm run start
```

Also set:

```env
NODE_ENV=production
CLIENT_URL="https://your-domain.com"
JWT_SECRET="a-long-random-secret"
```

Use HTTPS in production so secure cookies and Google OAuth redirects work reliably.
