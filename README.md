# HabitPulse

HabitPulse is a full-stack habit tracker built with Express, Prisma, SQLite, JWT auth, optional Google OAuth, and a Bootstrap 5 frontend.

## Features

- Email/password login and registration
- Optional Google OAuth login
- User-specific saved habits, check-ins, daily goals, monthly goals, yearly goals
- Streaks, completion rates, weekly activity, category analytics
- Personalized suggestions based on consistency and goal progress
- Responsive Bootstrap UI with minimal motion and Gen-Z visual styling

## Quick Start

```bash
npm install
copy .env.example .env
npm run db:push
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For the complete auth, database, Google OAuth, and deployment flow, read [INTEGRATION.md](./INTEGRATION.md).

## Google Login Setup

1. Go to Google Cloud Console.
2. Create an OAuth 2.0 Client ID for a Web Application.
3. Add this authorized redirect URI:

```text
http://localhost:3000/api/auth/google/callback
```

4. Put the values in `.env`:

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
```

Restart the server. The Google login button will work automatically once those values are present.

## Production Checklist

- Replace `JWT_SECRET` with a long random value.
- Use PostgreSQL instead of SQLite for hosted production traffic.
- Set `NODE_ENV=production`.
- Set `CLIENT_URL` to your real domain.
- Use HTTPS so secure auth cookies work correctly.
- Add an email verification flow before allowing sensitive actions.
- Configure backups for the production database.

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/habits`
- `POST /api/habits`
- `PATCH /api/habits/:id`
- `DELETE /api/habits/:id`
- `POST /api/habits/:id/logs`
- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id`
- `DELETE /api/goals/:id`
- `GET /api/insights/summary`
