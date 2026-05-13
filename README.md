# PIDEC 1.0 Backend API

The core backend system for the Prototype Inter-Departmental Engineering Challenge (PIDEC). This repository handles secure team collaboration, multi-stage project submissions, judge evaluations, document verification via AI, and comprehensive administrative controls.

## 🚀 Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL with Row Level Security & pgBouncer)
- **Validation:** Zod (Strict schema validation across all inputs)
- **Queue & Async:** BullMQ + Redis (Asynchronous job processing)
- **Emails:** Resend + React Email
- **AI Verification:** Groq Vision API (Primary) & Google Gemini (Fallback)

## 📁 Repository Structure

The backend follows a domain-driven architectural pattern within a monorepo setup:

```
├── apps/api/
│   ├── src/
│   │   ├── domain/         # Core business logic, Entities, Repositories, Services
│   │   ├── infrastructure/ # External integrations (DB, Emails, AI, Auth, Queues)
│   │   ├── presentation/   # Express Controllers, Middlewares, Routes
│   │   └── shared/         # Logging, Error mappings, Configs
│   └── package.json
├── packages/
│   ├── db-types/           # Generated Supabase TypeScript definitions
│   └── shared/             # Zod validation schemas and shared constants
├── supabase/
│   └── migrations/         # PostgreSQL migration files, RLS, triggers
└── render.yaml             # Render deployment configuration
```

## 🔒 Security & Performance Features

- **Rate Limiting:** Redis-backed rate limiters for all endpoints to prevent abuse (e.g., global limits, strict login/registration limits).
- **Authentication:** JWTs delivered securely via HTTP-Only, Secure, `SameSite=Strict` cookies.
- **Queue Limits:** AI document extraction runs in non-blocking BullMQ workers capped at strict concurrency limits to prevent upstream API timeouts.
- **Robust Headers:** Helmet.js enabled, tight CORS whitelisting, and stack traces removed from production errors.

## 🛠️ Local Development

### Prerequisites
- Node.js (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- Redis (running locally or via cloud)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local DB development)

### Environment Variables
Create an `.env` file in `apps/api` (refer to `.env.example` if available) and add:
```env
PORT=3001
NODE_ENV=development
WEB_URL=http://localhost:3000
CORS_ORIGIN=*

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database / Redis
REDIS_URL=redis://127.0.0.1:6379

# Secrets
JWT_SECRET=your_jwt_secret

# Emails & AI
RESEND_API_KEY=your_resend_key
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### Setup & Run
1. Install dependencies across the workspace:
   ```bash
   pnpm install
   ```
2. Build shared packages:
   ```bash
   pnpm run build:shared
   ```
3. Start the API in watch mode:
   ```bash
   pnpm run dev:api
   ```

## 🚀 Deployment (Render)

This repository is configured for automated deployment via [Render Blueprints](https://render.com/docs/blueprint-spec). 

1. Connect the repository to your Render account.
2. Select the "Blueprint" sync to parse the `render.yaml` file.
3. Add your production environment variables (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, etc.) manually in the Render dashboard.
4. Render will automatically install `pnpm`, build the monorepo, and start the `apps/api` Express server.
