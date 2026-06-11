# FTI Loan — React App

Fast. Trusted. Inclusive. — SME lending platform for Abuja entrepreneurs.

## Stack
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Cloudflare Pages
- **Auth**: Custom (bcrypt via Supabase functions)
- **State**: Zustand + TanStack Query

## Roles
| Role | Access |
|------|--------|
| `super_admin` | Full system access |
| `manager` | Loan approvals, form approvals |
| `agent` | Client onboarding, payments |
| `client` | Apply for loans, view schedule |
| `operator` | Disbursements, QR scan |
| `auditor` | Read-only reports |
| `security_officer` | IP blocking, threat monitoring |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
```bash
cp .env.example .env.local
# Fill in your Supabase URL and anon key
```

### 3. Database
Run `ftiloan_supabase_schema.sql` in Supabase SQL Editor

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy
Push to `main` branch → Cloudflare Pages auto-deploys

## Environment Variables
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
