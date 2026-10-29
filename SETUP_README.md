# Aish Fatima's Reviews — live upload add-on

This project preserves the original `index.html`, `videos.html`, `css/style.css`, Google Drive scripts, CNAME, and existing visual layout. It adds an upload page and optional Supabase-backed live media gallery.

## Before publishing
1. Keep a backup of your current GitHub repository.
2. In Supabase SQL Editor, run `SUPABASE_SETUP.sql` (safe to rerun; it only manages policies for this gallery table/bucket). It creates a new `gallery-media` public bucket and `gallery_media` table. It does not drop existing tables or delete existing media.
3. In Supabase Dashboard > Project Settings > API, copy the Project URL and the publishable/anon key. Never use `service_role` or secret keys in browser code.
4. Paste these into `js/supabase-config.js` replacing the two `PASTE_...` placeholders.
5. In Supabase Authentication settings, disable public sign-ups. Create only the intended client account under Authentication > Users. Use the client's email as the ID and a strong password.
6. In Authentication URL configuration, add your live website URL to Site URL and Redirect URLs as needed.
7. Upload the added/changed files to the existing GitHub repository without deleting original files. Commit/push and wait for GitHub Pages to redeploy.
8. Open `https://aishfatimafeedback.in/admin.html`, sign in, upload one small test image, then check the live gallery and video page.

## Important limits / security
- Gallery files in the public bucket are publicly viewable by design, because the request is to show them on a public website. Do not upload private content.
- Authenticated accounts can upload and add metadata, so disable public sign-ups and keep only the intended client account. The SQL removes the delete policy from earlier drafts and creates no delete permission. For strict single-account authorization, use a dedicated role/claim policy before production use.
- There is intentionally no delete policy in the starter.
- Existing Google Drive galleries continue to load as before; Supabase uploads are appended to the appropriate gallery page. This preserves the original gallery source rather than replacing it.
- Storage limits, file size limits and bandwidth depend on your Supabase plan. Large videos may need compression.
