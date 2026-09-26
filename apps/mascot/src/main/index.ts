/**
 * Electron main process: the always-on-top transparent pet window, tray, the HTTP bridge to the
 * engine's POST /ask, and a WebSocket relay of engine events to the renderer.
 */
import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { join } from "node:path";
import { AskRequest, AskResponse, WsEvent } from "@cortex/schema";
import { FORWARDED_EVENT_TYPES, IPC, type MascotEvent } from "../shared/types";

const ENGINE_HTTP_URL = process.env.ENGINE_HTTP_URL ?? "http://localhost:4000";
const ENGINE_WS_URL = process.env.ENGINE_WS_URL ?? "ws://localhost:4000/ws";
const WINDOW = { width: 360, height: 220 } as const;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const x = Math.round(workArea.x + (workArea.width - WINDOW.width) / 2);
  const y = workArea.y;
  const w = new BrowserWindow({
    ...WINDOW,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  w.setAlwaysOnTop(true, "floating");
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.once("ready-to-show", () => w.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void w.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void w.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return w;
}

function createTray(): Tray {
  // 16x16 transparent placeholder; replace with resources/tray.png when the mascot has a face.
  const icon = nativeImage.createEmpty();
  const t = new Tray(icon);
  t.setToolTip("Cortex mascot");
  t.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => win?.show() },
      { label: "Hide", click: () => win?.hide() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  return t;
}

async function ask(text: string, speak: boolean): Promise<unknown> {
  const body = AskRequest.parse({ text, client: "mascot", speak });
  const res = await fetch(`${ENGINE_HTTP_URL}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`engine /ask ${res.status}: ${await res.text()}`);
  return AskResponse.parse(await res.json());
}

/** Connects to the engine WebSocket and forwards the events the pet reacts to. Reconnects with backoff. */
function relayEngineEvents(getWindow: () => BrowserWindow | null): void {
  let attempt = 0;
  const forwarded = new Set<string>(FORWARDED_EVENT_TYPES);
  const connect = (): void => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(ENGINE_WS_URL);
    } catch {
      schedule();
      return;
    }
    ws.addEventListener("open", () => {
      attempt = 0;
    });
    ws.addEventListener("message", (msg) => {
      const parsed = WsEvent.safeParse(safeJson(String(msg.data)));
      if (!parsed.success || !forwarded.has(parsed.data.type)) return;
      getWindow()?.webContents.send(IPC.event, parsed.data as MascotEvent);
    });
    ws.addEventListener("close", schedule);
    ws.addEventListener("error", () => ws.close());
  };
  const schedule = (): void => {
    attempt += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    setTimeout(connect, delay);
  };
  connect();
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide();
  win = createWindow();
  tray = createTray();
  relayEngineEvents(() => win);

  ipcMain.handle(IPC.ask, (_e, text: unknown, opts: unknown) => {
    if (typeof text !== "string" || text.trim().length === 0) throw new Error("ask: text required");
    const speak = typeof opts === "object" && opts !== null && (opts as { speak?: unknown }).speak === true;
    return ask(text, speak);
  });
  ipcMain.on(IPC.setClickThrough, (_e, enabled: unknown) => {
    win?.setIgnoreMouseEvents(enabled === true, { forward: true });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
  });
});

app.on("window-all-closed", () => {
  tray?.destroy();
  app.quit();
});
