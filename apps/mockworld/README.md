# Mock world (`@cortex/mockworld`)

Maya's fictional apps: MockLoft (listings), Inbox, Calendar, Landlord chat. This is the stage the demo runs on. Unowned track: say so in the team chat before you take it. Data comes from `@cortex/persona`; the UI is plain and clearly fictional.

## Routes

| Route | Page | Landmark |
| --- | --- | --- |
| `/` | redirects to `/listings` | |
| `/listings?max_price=&neighborhood=&train=&hunt=` | search results with a GET filter form (`#filters`), cards linking to details (`a[data-listing-id]`) | `main#app-root[data-app=mockloft]` |
| `/listings/[id]` | listing detail with `Reject` button (`#reject`) and landlord form (`#message-form`, button text `Send message`) | `main#app-root[data-app=mockloft]` + every attribute as `data-*` |
| `/inbox` | threads from the persona seed plus landlord chats written at runtime | `main#app-root[data-app=inbox]` |
| `/inbox/[thread]` | thread view | `data-app=inbox` or `landlord_chat` |
| `/calendar` | 30-day grid of simulated days | `main#app-root[data-app=calendar]` |
| `POST /api/reject` | `{listing_id}` | requires `x-cortex-write-token` |
| `POST /api/messages` | `{listing_id, body, day?, sent_by?}` → `{message, reply}` with a canned landlord reply | requires `x-cortex-write-token` |

Every page sets `data-page-title` on `main#app-root`; capture hooks read it and `data-app`.

## Listing `data-*` contract

On `/listings/[id]` the `main#app-root` element carries: `data-listing-id`, `data-price`, `data-neighborhood`, `data-train`, `data-floor`, `data-elevator`, `data-laundry`, `data-pets` (booleans as `"true"`/`"false"`), `data-walkup-floor`. The capture hook and the agent's `read_listing()` parse these; nothing reads the listings collection directly.

## Data

`src/lib/data.ts` imports `packages/persona/data/*.json` statically and validates with `@cortex/schema`. Regenerate the persona (`pnpm --filter @cortex/persona generate`) and restart `next dev` to see new listings. Photos are deterministic inline SVG placeholders unless a listing has `photos`.

Writes (rejections, landlord messages) live in an in-memory store (`src/lib/world-store.ts`) and reset on restart. `TODO(engine)` marks where the Atlas `messages` write goes.

## Environment

| Variable | Use |
| --- | --- |
| `CORTEX_WRITE_TOKEN` | Server-side token every write endpoint requires. Unset means every write is rejected. |
| `NEXT_PUBLIC_CORTEX_WRITE_TOKEN` | Dev only: lets the buttons in the browser call the write endpoints. Do not set on the public Vercel deploy; Playwright sends the header itself. |

## Playwright

Navigate to `/listings`, click `a[data-listing-id="listing:214"]`, wait for `main#app-root[data-listing-id]`, read attributes with `getAttribute`, click `#reject` or fill `#message-body` and click `text=Send message`. Set the `x-cortex-write-token` header on the browser context with `context.setExtraHTTPHeaders`.

```bash
pnpm --filter @cortex/mockworld dev        # http://localhost:3000
pnpm --filter @cortex/mockworld test       # filter, auth, thread grouping
```
