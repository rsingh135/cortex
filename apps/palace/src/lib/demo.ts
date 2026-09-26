"use client";
/**
 * Demo-ops actions behind the hotkeys (docs/demo.md). Everything here degrades to a toast when the
 * engine or an asset is missing, so a rehearsal never dead-ends.
 */
import { ENGINE_URL, usePalaceStore } from "./store";

export const DEMO_ASSETS = {
  journal: "/demo/dream-journal.mp3",
  fallbackVideo: "/demo/fallback.mp4",
  voiceWav: "/demo/voice-dog.wav",
} as const;

async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok && !(res.headers.get("content-type") ?? "").includes("text/html");
  } catch {
    return false;
  }
}

let journalAudio: HTMLAudioElement | null = null;

/** `J`: play the pre-generated dream journal once; a second press restarts it. */
export async function playDreamJournal(): Promise<void> {
  const { toast } = usePalaceStore.getState();
  if (!(await assetExists(DEMO_ASSETS.journal))) {
    toast("dream-journal.mp3 missing (apps/palace/public/demo)");
    return;
  }
  journalAudio?.pause();
  journalAudio = new Audio(DEMO_ASSETS.journal);
  try {
    await journalAudio.play();
    toast("Dream journal playing");
  } catch {
    toast("Dream journal blocked: click the page first");
  }
}

/** `F`: full-screen fallback video when it exists; otherwise say so. */
export async function openFallback(): Promise<void> {
  const { toast, setFallbackOpen } = usePalaceStore.getState();
  if (!(await assetExists(DEMO_ASSETS.fallbackVideo))) {
    toast("fallback.mp4 missing (apps/palace/public/demo)");
    return;
  }
  setFallbackOpen(true);
}

/** `V`: push the pre-recorded voice note through the engine's speech path. */
export async function sendVoiceFallback(): Promise<void> {
  const { toast } = usePalaceStore.getState();
  if (!ENGINE_URL) {
    toast("voice fallback: no engine configured");
    return;
  }
  if (!(await assetExists(DEMO_ASSETS.voiceWav))) {
    toast("voice-dog.wav missing (apps/palace/public/demo)");
    return;
  }
  try {
    const wav = await (await fetch(DEMO_ASSETS.voiceWav)).blob();
    const form = new FormData();
    form.set("audio", wav, "voice-dog.wav");
    form.set("day", String(usePalaceStore.getState().snapshot.day));
    const res = await fetch(`${ENGINE_URL}/voice`, { method: "POST", body: form });
    toast(res.ok ? "Voice note sent" : `voice fallback: engine POST /voice returned ${res.status}`);
  } catch {
    toast("voice fallback: engine POST /voice not reachable");
  }
}

/** `A`: approve every pending landlord draft. */
export async function approveAllDrafts(): Promise<void> {
  const { toast, pendingDrafts, setPendingDrafts } = usePalaceStore.getState();
  if (!ENGINE_URL) {
    toast("approve drafts: no engine configured");
    return;
  }
  if (pendingDrafts.length === 0) {
    toast("approve drafts: nothing pending");
    return;
  }
  const results = await Promise.all(
    pendingDrafts.map(async (id) => {
      try {
        const res = await fetch(`${ENGINE_URL}/agent/drafts/${encodeURIComponent(id)}/approve`, { method: "POST" });
        return res.ok;
      } catch {
        return false;
      }
    }),
  );
  const sent = results.filter(Boolean).length;
  setPendingDrafts(pendingDrafts.filter((_, i) => !results[i]));
  toast(sent === pendingDrafts.length ? `Approved ${sent} draft${sent === 1 ? "" : "s"}` : `Approved ${sent} of ${pendingDrafts.length}; engine endpoint pending`);
}
