# EduNest — Kindergarten School Management System

A multi-tenant fullstack web application for managing kindergartens in the Algerian market. Built with Node.js/Express backend, React/Vite frontend, PostgreSQL database, and bilingual support (Arabic RTL + French LTR).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Frontend | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui |
| Database | PostgreSQL 15 |
| Real-time | Socket.io |
| i18n | react-i18next (Arabic RTL + French LTR) |
| Auth | JWT (access + refresh tokens), bcrypt |
| Payments | Chargily Pay (Edahabia + CIB) |
| File Storage | Cloudinary (authenticated uploads) |
| Notifications | Firebase FCM, Resend (email), Twilio (SMS) |

## Project Structure

```
edunest/
├── backend/               # Express API server
│   ├── prisma/            # Database schema & migrations
│   ├── src/
│   │   ├── modules/       # Feature modules (auth, schools, users, etc.)
│   │   ├── middleware/    # Auth, RBAC, tenancy, validation
│   │   ├── services/      # Shared services (notifications, socket, etc.)
│   │   └── lib/           # Prisma client, utilities
│   └── scripts/           # Seed scripts
├── frontend/              # React SPA
│   ├── src/
│   │   ├── components/    # UI components (layout, forms, ui)
│   │   ├── pages/         # Page components (admin, teacher, parent)
│   │   ├── hooks/         # React Query hooks
│   │   ├── contexts/      # Auth context
│   │   ├── i18n/          # Translation files (ar, fr)
│   │   └── lib/           # API client, utilities
│   └── public/
├── docker-compose.yml     # Local dev with PostgreSQL
└── .env.example           # Environment variables template
```

## Prerequisites

- **Node.js** 20+
- **Docker** (for PostgreSQL) or a local PostgreSQL 15 instance
- **npm** 9+

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd edunest
```

### 2. Install dependencies

```bash
npm install
```

This installs dependencies for both backend and frontend (monorepo workspaces).

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values. For local development, the defaults work with Docker Compose.

Also create the backend-specific env file:

```bash
cp .env.example backend/.env
```

The key variables for local dev:
```
DATABASE_URL=postgresql://edunest:edunest_secret@localhost:5432/edunest?schema=public
JWT_ACCESS_SECRET=dev-access-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
```

### 4. Start PostgreSQL

```bash
docker compose up postgres -d
```

This starts a PostgreSQL 15 container on port 5432 with:
- User: `edunest`
- Password: `edunest_secret`
- Database: `edunest`

### 5. Run database migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 6. Seed the database

```bash
cd backend
npx ts-node --transpile-only prisma/seed.ts
```

This creates test users and sample data:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | super@edunest.dz | super123 |
| Admin | admin@edunest.dz | admin123 |
| Teacher | teacher@edunest.dz | teacher123 |
| Parent | parent@edunest.dz | parent123 |

To create the super admin separately:
```bash
npx ts-node --transpile-only scripts/create-super-admin.ts
```

### 7. Start the development servers

**Backend** (runs on port 3000):
```bash
cd backend
npm run dev
```

**Frontend** (runs on port 5173):
```bash
cd frontend
npm run dev
```

### 8. Open the app

Navigate to **http://localhost:5173** and sign in with any of the test credentials above.

## User Roles

| Role | Portal | Capabilities |
|------|--------|-------------|
| **super_admin** | Admin | Manage all schools, create/deactivate schools, full platform access |
| **admin** | Admin | Manage own school: users, classrooms, children, attendance, finance, communication |
| **teacher** | Teacher | Mark attendance, create daily reports, message parents |
| **parent** | Parent | View daily reports, attendance history, messages, invoices, consent forms |

## Key Features

- **Multi-tenancy**: Row-level data isolation per school via `schoolId`
- **RBAC**: Role-based access control on every endpoint
- **Bilingual**: Full Arabic (RTL) and French (LTR) support with one-click switching
- **Real-time**: Socket.io for live messaging and notifications
- **Finance**: Fee structures, invoices, Chargily Pay integration, cash payments, audit trail
- **Attendance**: Bulk marking, absence notifications, monthly reports
- **Communication**: Parent-teacher messaging, daily reports, announcements, events with consent

## Available Scripts

### Backend

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio   # Open Prisma database GUI
npx prisma migrate dev  # Create new migration
```

### Frontend

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build (type-check + bundle)
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Docker (Full Stack)

To run the entire stack with Docker:

```bash
docker compose up --build
```

This starts:
- PostgreSQL on port 5432
- Backend on port 4000
- Frontend (nginx) on port 3000

## E2E Testing

Playwright end-to-end tests live in `e2e/`, covering login for all roles, admin user management, teacher attendance marking, and parent portal navigation.

```bash
docker compose up postgres -d   # if not already running
npm run test:e2e                # headless run
npm run test:e2e:ui             # interactive UI mode
```

Each run resets a dedicated `edunest_e2e` database (drop, recreate, migrate, seed) and starts the backend/frontend on separate ports (`3100`/`5180`) from your normal dev servers, so it's safe to run alongside `npm run dev` without touching your local data.

## API Documentation

All API endpoints follow the format:
```json
// Success
{ "success": true, "data": T, "meta": { "pagination": { "page", "pageSize", "total", "totalPages" } } }

// Error
{ "success": false, "error": { "code": "string", "message": "string", "details": [] } }
```

Authentication: Bearer token in `Authorization` header.

## Environment Variables

See `.env.example` for the full list. Required for production:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `CHARGILY_API_KEY` | Chargily Pay API key |
| `CHARGILY_SECRET_KEY` | Chargily webhook signature key |
| `CLOUDINARY_*` | Cloudinary credentials for file uploads |
| `RESEND_API_KEY` | Resend email service key |
| `TWILIO_*` | Twilio SMS credentials |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase FCM service account JSON |

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run build` in both backend and frontend to verify
4. Submit a pull request

## License

Private — All rights reserved.
