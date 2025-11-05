# Subscription Tracker

This app helps you track recurring subscriptions with Supabase as the backend and a Vite + React frontend. The interface now displays provider logos (or emoji fallbacks) for a quick visual scan, and includes an admin console for managing provider metadata.

## Getting started

```bash
npm install
npm run dev
```

Set the following environment variables (e.g., `.env.local`) so the client can reach Supabase:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Run `npm run build` before deploying to ensure TypeScript types and the production bundle are valid.

## Provider logos & admin tools

- Provider/emoji mapping is seeded in Supabase (`subscription_providers` and the new columns on `subscriptions`).
- Logos live under `public/logos/<slug>.svg` and are referenced via relative paths.
- An authenticated admin can manage providers and manual overrides at `/admin/providers` (link available in the header for admin users).
- Default fallbacks: ✨ (`sparkles`), 🌐 (`globe`), 🚀 (`rocket`), 👛 (`wallet`), and 📅 (`calendar`).

See `docs/provider-admin.md` for the full Supabase migration steps, admin workflow, and maintenance checklist.
