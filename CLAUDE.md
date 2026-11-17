# Project notes for Claude

Short, project-specific rules. Working style lives in the owner's private memory, not here.

## Build and deploy
- Static site: pages live in `public/`, Vite builds to `dist/`, Render serves it.
- Commit directly to `main` — the owner works trunk-only. No branches.
- Deploy is automatic on push, or manual from the Render dashboard.

## Third-party services
- Only documented, public interfaces may be used for shipped tools.
- Endpoints or files labelled `internal`, `private`, `admin` or `debug` are
  off-limits without the service owner's explicit permission.
- The owner cares about crediting contributors accurately — keep the README
  credits specific and current.
