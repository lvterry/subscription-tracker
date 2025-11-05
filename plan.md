## Logo Feature Plan

### Schema & Data Layer
- Introduce a shared normalization utility that standardizes subscription names (lowercase, strip punctuation/spaces) before any database write or lookup.
- Create a Supabase migration adding a `subscription_providers` table with columns `id`, `slug`, `display_name`, `logo_path`, `last_verified_at`, and `notes`.
- Extend the `subscriptions` table with nullable `provider_id`, `fallback_icon_key`, and `normalized_name`, and add an index on `normalized_name` to speed matches.
- Seed the provider table with curated entries (Netflix, Apple Music, ChatGPT, etc.) following the normalized slug rule.
- Configure RLS policies so only users whose JWT exposes `user.app_metadata.is_admin === true` can read/write provider‑management operations.

### Backfill & Maintenance
- Write a one-off backfill script that normalizes all existing subscription names, assigns matching providers, otherwise sets a random fallback key, and logs ambiguous cases for manual override.
- Document a repeatable procedure for rerunning normalization/backfill after asset updates or new provider seeds.
- Maintain a manual change log noting when `last_verified_at` updates are needed after rebrands.

### Asset & Fallback Strategy
- Store all branded logos as single-size SVGs inside `public/logos/<slug>.svg`, keeping a naming/versioning checklist (e.g., bump filename or add `?v=` query when updating).
- Define a constant list of fallback emojis, keyed (e.g., `sparkles`, `globe`); persist only the key in Supabase so clients map key → emoji consistently across sessions.

### Service & API Updates
- Update `subscription-service.ts` queries to join provider info and return `logoUrl` (relative path), `providerName`, and `fallbackIconKey` alongside existing fields.
- Enhance create/update flows to normalize the name, look up the provider slug, set `provider_id` if found, otherwise assign/persist a random fallback icon key; allow overrides when admin reassigns providers.
- Expose admin-only service functions to list providers, show unmatched subscriptions, and patch subscription `provider_id`/`fallback_icon_key`.

### UI Components & Screens
- Build a reusable `SubscriptionLogo` component that renders the provider logo via `/logos/<slug>.svg`, falls back to the mapped emoji, and ultimately to a gray placeholder on load failure; `alt` text uses the provider or subscription name.
- Integrate the component into existing subscription row layouts, ensuring consistent square sizing and visual balance for both themes.
- Develop a protected admin UI route that:
  - Lists providers and allows editing display name, notes, `last_verified_at`.
  - Shows unmatched or conflicted subscriptions and offers manual overrides for provider assignment or fallback selection.
  - Reflects RLS by only rendering for users with the `is_admin` flag; no logo uploads, only metadata edits.

### Testing & Documentation
- Add unit tests for the normalization helper and fallback selection logic; create component tests verifying logo/emoji/placeholder render order.
- Write a short operator guide covering: placing new logo files, seeding providers, toggling `app_metadata.is_admin`, running backfill, and verifying changes (see `docs/provider-admin.md`).
- Confirm that relative logo URLs work in both local dev and production builds, adjusting Vite config if any base-path issues surface; run `npm run build` as part of verification.
