/** Exposes a minimal, typed bridge to the renderer. No Node APIs leak past this file. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { AskResponse } from "@cortex/schema";
import { IPC, type MascotBridge, type MascotEvent } from "../shared/types";

const bridge: MascotBridge = {
  ask: (text, opts) => ipcRenderer.invoke(IPC.ask, text, opts ?? {}) as Promise<AskResponse>,
  setClickThrough: (enabled) => ipcRenderer.send(IPC.setClickThrough, enabled),
  onEvent: (cb) => {
    const handler = (_e: IpcRendererEvent, event: MascotEvent): void => cb(event);
    ipcRenderer.on(IPC.event, handler);
    return () => ipcRenderer.removeListener(IPC.event, handler);
  },
};

contextBridge.exposeInMainWorld("mascot", bridge);
