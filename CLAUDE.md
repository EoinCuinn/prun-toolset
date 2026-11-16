# Project notes for Claude

Short, project-specific rules. Working style lives in the owner's private memory, not here.

## Build and deploy
- Static site: pages live in `public/`, Vite builds to `dist/`, Render serves it.
- Commit directly to `main` — the owner works trunk-only. No branches.
- Deploy is automatic on push, or manual from the Render dashboard. A daily
  GitHub Action calls the Render deploy hook to refresh the Shipping Routes data.

## Shipping Routes page
- `public/prun_shipping_routes.html` is **unlisted**: never link it from
  `home.html`, the README tool table, or any public page. It has `noindex`.
- Its data is built by `scripts/fetch-data.mjs` at deploy time and encrypted with
  `PAGE_PASS`. Never commit the generated bundle (`public/punoted_data*.json`) or
  any secret. The corp password lives only in Render.
- If the data fetch fails, the build must fail so Render keeps the previous deploy.

## Third-party services
- Only documented, public interfaces may be used for shipped tools.
- Endpoints or files labelled `internal`, `private`, `admin` or `debug` are
  off-limits without the service owner's explicit permission.
- The owner cares about crediting contributors accurately — keep the README
  credits specific and current.
