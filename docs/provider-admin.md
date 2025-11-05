# Provider Admin Workflow

This feature lets admins maintain subscription provider metadata and logos while users automatically see the correct badge for each subscription.

## Prerequisites
- The Supabase schema changes and backfill script from `plan.md` must be applied.
- Your Supabase user account needs `app_metadata.is_admin` set to `true`. Update it with:

  ```sql
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('is_admin', true)
  where email = 'admin@example.com';
  ```

- Log out and back in after toggling the flag so the new JWT claim is issued.

## Logo assets
1. Drop SVG files into `public/logos/<provider-slug>.svg`.
2. Keep the art 48×48 (or scalable SVG) with a transparent background when possible.
3. Bump the filename or add a `?v=` c query when you update an asset to avoid stale caching.

## Managing providers
1. Sign in as an admin and open `/admin/providers` (or click **Admin** in the main header).
2. Use the **Providers** list to select an existing entry or click **New provider**.
3. Fill in slug, display name, logo path, notes, and optionally mark the logo as “verified” to timestamp your review.
4. Save changes. The list refreshes automatically.
5. To remove a provider, select it and click **Delete**.

## Matching subscriptions
1. The **Unmatched subscriptions** table shows entries without a matching provider.
2. Choose a provider from the dropdown or leave “No provider” selected to keep an emoji fallback.
3. Pick a fallback emoji key (randomized if omitted) and click **Apply**.
4. After assignment, the row disappears; you can click **Refresh** to pull the latest state.

## Default emoji fallbacks
Apps without a logo use one of the following emoji keys (stored in Supabase):

| Key       | Emoji |
|-----------|-------|
| sparkles  | ✨    |
| globe     | 🌐    |
| rocket    | 🚀    |
| wallet    | 👛    |
| calendar  | 📅    |

## Validation
- Run `npm run build` to ensure TypeScript and bundling succeed.
- Load the main dashboard to confirm provider logos, fallback emoji, and placeholders behave as expected.
- Verify admin-exclusive actions (CRUD providers and overrides) while signed in as an admin; non-admin users see a restricted screen.
