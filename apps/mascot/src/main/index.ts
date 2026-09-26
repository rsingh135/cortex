import { synthesizeSpeech } from "./speech";
/**
 * Electron main process: the always-on-top transparent pet window, tray, the HTTP bridge to the
 * engine's POST /ask, and a WebSocket relay of engine events to the renderer.
 */
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { existsSync } from "node:fs";
import { MemoryNotebook } from "./memory";
import { transcribeAudio, createRealtimeToken } from "./transcribe";
import { join } from "node:path";
import { AskRequest, AskResponse, WsEvent } from "@cortex/schema";
import { FORWARDED_EVENT_TYPES, IPC, LISTEN_SHORTCUT, type MascotEvent } from "../shared/types";

// pnpm starts in apps/mascot; accept a local override or the repository .env.
for (const path of [join(process.cwd(), ".env"), join(__dirname, "../../../..", ".env")]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

const ENGINE_HTTP_URL = process.env.ENGINE_HTTP_URL ?? "http://localhost:4000";
const ENGINE_WS_URL = process.env.ENGINE_WS_URL ?? "ws://localhost:4000/ws";
const WINDOW = { width: 400, height: 680 } as const;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let dragOrigin: { x: number; y: number; wx: number; wy: number } | null = null;

function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const x = Math.round(workArea.x + workArea.width - WINDOW.width);
  const y = Math.round(workArea.y + workArea.height - WINDOW.height);
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
  w.setIgnoreMouseEvents(true, { forward: true });
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.once("ready-to-show", () => w.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void w.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void w.loadFile(join(__dirname, "../renderer/index.html"));
  }
  const cursorTimer = setInterval(() => {
    if (w.isDestroyed() || !w.isVisible()) return;
    const point = screen.getCursorScreenPoint();
    if (dragOrigin) w.setPosition(Math.round(dragOrigin.wx + point.x - dragOrigin.x), Math.round(dragOrigin.wy + point.y - dragOrigin.y));
    const bounds = w.getBounds();
    w.webContents.send(IPC.cursor, { x: point.x - bounds.x, y: point.y - bounds.y });
  }, 50);
  w.once("closed", () => clearInterval(cursorTimer));
  return w;
}

function createTray(): Tray {
  // Small monochrome brain silhouette, rendered without a platform-specific asset loader.
  const pixels = Buffer.alloc(16 * 16 * 4);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    if (((x - 7.5) / 6) ** 2 + ((y - 7) / 6) ** 2 < 1 && !(x === 7 && y < 8)) pixels[(y * 16 + x) * 4 + 3] = 255;
  }
  const icon = nativeImage.createFromBitmap(pixels, { width: 16, height: 16 });
  icon.setTemplateImage(true);
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
    signal: AbortSignal.timeout(60000),
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

  const notebook = new MemoryNotebook(join(app.getPath("userData"), "memories.json"), ENGINE_HTTP_URL);
  ipcMain.handle(IPC.saveMemory, (_e, text: unknown) => {
    if (typeof text !== "string") throw new Error("Memory text required.");
    return notebook.save(text);
  });
  ipcMain.handle(IPC.listMemories, () => notebook.list());
  ipcMain.handle(IPC.retryMemory, (_e, id: unknown) => {
    if (typeof id !== "string") throw new Error("Memory ID required.");
    return notebook.retry(id);
  });
  ipcMain.handle(IPC.synthesize, (_e, text: string) => synthesizeSpeech(text));
  ipcMain.handle(IPC.realtimeToken, () => createRealtimeToken());
  ipcMain.handle(IPC.transcribe, (_e, bytes: Uint8Array, mime: string) => transcribeAudio(bytes, mime));
  ipcMain.handle(IPC.ask, (_e, text: unknown, opts: unknown) => {
    if (typeof text !== "string" || text.trim().length === 0) throw new Error("ask: text required");
    const speak = typeof opts === "object" && opts !== null && (opts as { speak?: unknown }).speak === true;
    return ask(text, speak);
  });
  ipcMain.on(IPC.drag, (_e, active: unknown) => {
    if (active === true && win) {
      const point = screen.getCursorScreenPoint(), bounds = win.getBounds();
      dragOrigin = { x: point.x, y: point.y, wx: bounds.x, wy: bounds.y };
      win.setIgnoreMouseEvents(false);
    } else dragOrigin = null;
  });
  ipcMain.on(IPC.setClickThrough, (_e, enabled: unknown) => {
    win?.setIgnoreMouseEvents(enabled === true && !dragOrigin, { forward: true });
  });

  // Option+V anywhere on the desktop: bring the pet forward and start listening.
  const registered = globalShortcut.register(LISTEN_SHORTCUT, () => {
    const target = win ?? (win = createWindow());
    if (target.isMinimized()) target.restore();
    target.show();
    target.setIgnoreMouseEvents(false);
    target.focus();
    target.webContents.send(IPC.startListening);
  });
  if (!registered) console.warn(`mascot: could not register ${LISTEN_SHORTCUT}; another app holds it`);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  tray?.destroy();
  app.quit();
});
