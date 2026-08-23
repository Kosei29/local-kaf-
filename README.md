# Local Kafé PWA — Auth Starter

This starter connects directly to the Supabase project **Local Kafé**.

## What works
- Email/password sign-up
- Email/password sign-in
- Automatic `profiles` row creation via the database trigger
- Creation of the first private group
- PWA manifest + service worker
- Installable shell once served over HTTPS (or localhost)

## Run locally
You need a local HTTP server; opening `index.html` directly as `file://` is not enough for service workers.

### Python
```bash
python -m http.server 8080
```
Then visit:
`http://localhost:8080`

### VS Code
You can also use a local static server extension.

## Important
Supabase email confirmation is enabled by default on hosted projects. After signing up, check the email inbox and confirm the account before signing in.

The client uses the Supabase **publishable** key, which is intended for frontend use. Never place a Supabase secret/service-role key in this project.

## Next
Add the shared café map and manual pin placement.
