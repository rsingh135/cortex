# Memory graph

`/` and `/graph` open the focused memory explorer. The existing walk-through
palace is preserved at `/palace`, and its agent map remains at `/map`.

Click the brain or **Explore the brain** for a full-page 3D network. **Open 2D
graph** enters the same explorer with a planar view. Escape or **Exit brain**
returns to the landing page and restores page scrolling and focus. Graph gestures
only capture input inside the explorer: drag to orbit, pinch/scroll to zoom,
right-drag to pan. Zoom, Fit all, and Focus memory also have visible buttons.
Navigation interpolates camera motion and respects reduced-motion preferences.

Both graph views use the same snapshot, selection, room/search filters, and real
edges. Search retains one hop of context; hiding evidence does not invent direct
belief-to-belief links. Selecting a capture shows its current screenshot with a
URL version tied to clarity/resolution so decay updates refresh the image.

Live mode reads the engine at `http://localhost:4000` by default. Configure
`NEXT_PUBLIC_ENGINE_URL` (or `NEXT_PUBLIC_ENGINE_HTTP_URL`) to override it, or
set `NEXT_PUBLIC_LIVE_SERVER_WS_URL` and derive the HTTP base from it. The client
validates snapshots, reconnects with backoff, and discards stale fetches and socket
messages. Demo mode is clearly labeled, runs locally, and never writes to Atlas.

Dark mode is the default; the header provides a light-mode switch. The graph is
read-only. It does not extract new facts or mutate memories.
