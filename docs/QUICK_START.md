# Quick start guide

Get Edgaze running locally in under 10 minutes. This guide walks you through the essential steps to set up your development environment.

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

---

## Prerequisites checklist

Before starting, ensure you have:

- [ ] **Repository access** — Authorization from Edgaze team required
- [ ] **Node.js 20+** installed ([Download](https://nodejs.org/))
- [ ] **npm 9+** (comes with Node.js)
- [ ] **Git** installed and configured
- [ ] **Supabase credentials** — Provided by team lead
- [ ] **Code editor** (VS Code recommended)

**Time required:** ~10 minutes

⚠️ **Note:** This is a **closed-source, proprietary platform**. Repository access is restricted to authorized team members only.

---

## Step 1: Clone the repository

⚠️ **Access required** — You must have repository access. Contact your team lead if you don't have credentials.

```bash
# Clone the repository (requires authentication)
git clone <repository-url>
cd edgaze-prod
```

---

## Step 2: Install dependencies

```bash
npm install
```

This will install all required packages (~2 minutes).

---

## Step 3: Set up Supabase

### Create a Supabase project

1. Go to [app.supabase.com](https://app.supabase.com/)
2. Click "New project"
3. Fill in project details:
   - **Name:** edgaze-dev
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to you
4. Wait for project to initialize (~2 minutes)

### Get your API keys

1. Go to **Project Settings** → **API**
2. Copy these values (you'll need them next):
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) ⚠️ Keep secret!

---

## Step 4: Configure environment

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your Supabase credentials:

```env
# Required
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Required for auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Optional (for Google OAuth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Generate NextAuth secret:**

```bash
openssl rand -base64 32
```

---

## Step 5: Set up the database

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR-PROJECT-REF

# Push migrations
supabase db push
```

### Option B: Manual setup

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Run each file from `supabase/migrations/` in order
4. Check **Table Editor** to verify tables were created

---

## Step 6: Run the development server

```bash
npm run dev
```

The application will start at **http://localhost:3000** 🚀

---

## Step 7: Verify setup

### Check the homepage

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the Edgaze landing page.

### Test authentication

1. Click **Sign in** in the header
2. Try signing up with email/password
3. Check your email for verification (if configured)
4. Sign in and verify you see your profile

### Browse the marketplace

Navigate to **Marketplace** to see the curated discovery page.

---

## Common issues

### Port 3000 already in use

```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Supabase connection error

- Double-check your environment variables
- Verify your Supabase project is not paused
- Ensure you copied the correct API keys

### Missing migrations

If tables don't exist:

```bash
# Push migrations again
supabase db push

# Or run manually in Supabase SQL Editor
```

### TypeScript errors

```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
```

---

## Next steps

Now that you're set up:

1. **Explore the codebase**
   - Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the structure
   - Review [DEVELOPMENT.md](DEVELOPMENT.md) for development workflow

2. **Configure OAuth (optional)**
   - Set up Google OAuth for social login
   - See [AUTH.md](../AUTH.md) for details

3. **Start building**
   - Create your first workflow in the builder
   - Publish a prompt in the studio
   - Customize your profile

4. **Read the docs**
   - [API Reference](API.md) — Understand the API
   - [Overview](OVERVIEW.md) — Technical standards and principles
   - [Development Guide](DEVELOPMENT.md) — Development workflow

---

## Development commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run lint` | Check code quality |
| `npm run typecheck` | Check TypeScript types |
| `npm run format` | Format code with Prettier |

---

## Getting help

- **Setup issues:** Check [DEVELOPMENT.md](DEVELOPMENT.md)
- **Auth problems:** See [AUTH.md](../AUTH.md)
- **General support:** [SUPPORT.md](../SUPPORT.md)

---

## What's included?

✅ **Frontend** — React 19, Next.js 16, Tailwind CSS  
✅ **Backend** — Next.js API routes, Supabase PostgreSQL  
✅ **Authentication** — Email/password + Google OAuth  
✅ **Database** — Pre-configured schema with migrations  
✅ **Dev tools** — TypeScript, ESLint, Prettier  
✅ **CI/CD** — GitHub Actions workflow  

---

**Ready to build?** Head to the [Development Guide](DEVELOPMENT.md) for detailed information.

Happy coding! 🚀
