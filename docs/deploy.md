# Deploying the judges' link

The demo runs on the laptop. The Vercel deployments exist so judges can open the palace and the mock world from the submission form.

## Vercel (through the GitHub integration, not the CLI)

1. Vercel dashboard → Add New Project → import `rsingh135/cortex` twice, once per app.
2. Project **cortex-mockworld**: Root Directory `apps/mockworld`, Framework Next.js, Build Command `pnpm turbo run build --filter=@cortex/mockworld`, Install Command `pnpm install --frozen-lockfile` at the repo root (enable "Include source files outside of the Root Directory"). Env: `CORTEX_WRITE_TOKEN`, `NEXT_PUBLIC_CORTEX_WRITE_TOKEN`.
3. Project **cortex-palace**: Root Directory `apps/palace`, same install and build pattern with `--filter=@cortex/palace`. Env: `NEXT_PUBLIC_LIVE_SERVER_WS_URL` and `NEXT_PUBLIC_ENGINE_URL` pointing at the tunnel below. Without them the deployed palace runs in fixture mode, which is fine for a judges' link.
4. Node 24 in project settings. Production branch `main`.

## Engine tunnel (only if the deployed palace should be live)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:4000
```

Copy the printed `https://….trycloudflare.com` into the palace project as `NEXT_PUBLIC_ENGINE_URL` and `wss://….trycloudflare.com/ws` as `NEXT_PUBLIC_LIVE_SERVER_WS_URL`, then redeploy. The tunnel URL changes every run; a named tunnel keeps it stable.

## Submission

- Repo public: `gh repo view rsingh135/cortex --json visibility`.
- Links: palace URL, mock world URL, one-minute video, README closing note listing what was built at the event.
