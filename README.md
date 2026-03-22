# XPS Intelligence Systems

Enterprise AI operating system for Xtreme Polishing Systems / XPS Xpress.

## Core capabilities
- Multi-location B2B lead intelligence
- CRM and store-aware routing
- Outreach automation
- Proposal / estimating acceleration
- Competitor intelligence
- Knowledge and distillation
- AI assistant per rep / manager / owner / admin

## Stack
- Next.js
- Node.js / TypeScript
- Supabase / Postgres
- Redis / BullMQ
- Railway
- GitHub Actions
- Shopify
- Stripe
- Twilio
- Firecrawl
- ElevenLabs
- Contentful
- Groq / Ollama-compatible endpoints / GPT Actions

## Local bootstrap
1. Copy `.env.example` to `.env`
2. Fill required secrets
3. Start Docker services
4. Install dependencies
5. Start apps

## Monorepo Build Requirements

This repository is a monorepo. The Docker build expects specific workspace
subproject files to be present. Before running `docker build`, validate the
build context:

```bash
bash scripts/validate-build-context.sh
```

### Required subprojects and files

The following paths **must** exist for a successful Docker build. Missing any
of these will cause the build to fail with a descriptive error.

| Path | Stage | Notes |
|------|-------|-------|
| `package.json` | frontend-builder | Root workspace manifest |
| `package-lock.json` | frontend-builder | Lock file for reproducible installs |
| `.npmrc` | frontend-builder | npm registry / workspace config |
| `apps/api/package.json` | api-builder, runner | API workspace manifest |
| `apps/api/src/` | api-builder | API TypeScript source |
| `apps/api/tsconfig.json` | api-builder | API TypeScript config |
| `apps/web/package.json` | frontend-builder | Web workspace manifest (needed for `npm ci`) |
| `apps/worker/package.json` | frontend-builder | Worker workspace manifest (needed for `npm ci`) |
| `index.html` | frontend-builder | Vite entry point |
| `src/` | frontend-builder | Frontend source |
| `vite.config.ts` | frontend-builder | Vite config |
| `tailwind.config.ts` | frontend-builder | Tailwind config |
| `postcss.config.js` | frontend-builder | PostCSS config |
| `components.json` | frontend-builder | shadcn/ui component registry |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | frontend-builder | TypeScript configs |

> **Important `.dockerignore` note:** `apps/web` and `apps/worker` are excluded
> from the Docker build context by `.dockerignore` to keep image size small.
> Their `package.json` files are re-included via `!apps/web/package.json` and
> `!apps/worker/package.json` exception rules, which are required for npm
> workspace resolution during `npm ci`.

### Optional subprojects

The following are optional — their absence is non-fatal for the Docker build
but may affect runtime functionality:

| Path | Purpose |
|------|---------|
| `apps/web/src/` | Web app source (scaffold only; Vite builds from root `src/`) |
| `apps/worker/src/` | Worker app source (scaffold only; not yet built in Docker) |
| `services/` | External service integrations |
| `scripts/agents/` | AI agent scripts |

### Adding a new required subproject

1. Create the directory and `package.json` under `apps/<name>/`
2. Add `COPY apps/<name>/package.json ./apps/<name>/` to `Dockerfile` (`frontend-builder` stage)
3. Add `apps/<name>/package.json` to the `REQUIRED_PATHS` array in `scripts/validate-build-context.sh`
4. Update this table in `README.md`
5. Ensure `.dockerignore` does **not** exclude `apps/<name>/package.json` (add a `!apps/<name>/package.json` exception if needed)

### TAP Governance

This build system follows **TAP (Policy > Authority > Truth)**:
- The validation script (`scripts/validate-build-context.sh`) is the authoritative source for what is required.
- The Dockerfile references the script in its comments.
- CI enforces the precheck via `.github/workflows/validate.yml` (`build-context-precheck` job).

## Source of truth
GitHub repository is the source of truth.
