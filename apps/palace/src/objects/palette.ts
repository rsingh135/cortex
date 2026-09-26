/**
 * Colours and dimensions shared by every memory object. Bright architectural palette: white
 * plaster, pale wood, soft daylight. Pure constants; no three or window access.
 */
import type { Kind } from "@cortex/schema";

export const PLASTER = "#f5f2eb";
export const PLASTER_SHADOW = "#e4dfd4";
export const PALE_WOOD = "#d8c3a0";
export const DARK_WOOD = "#b89a72";
export const GOLD = "#c9a227";
export const GLASS = "#dbe7ee";
export const GLASS_EDGE = "#9fb3bd";
export const INK = "#3a3632";
export const CRACK_INK = "#2b2926";
export const CRACK_RED = "#c8321e";
export const FORGOTTEN_CANVAS = "#ebe6dc";
export const HOVER_EMISSIVE = "#ffe9b0";
export const SELECT_EMISSIVE = "#ffd27a";
export const PULSE_EMISSIVE = "#ffb85c";
export const THREAD_EVIDENCE = "#8c9bb5";
export const THREAD_SOLID = "#6b7a94";
export const THREAD_DASHED = "#a48ad4";

/** Base hue per belief kind; saturation scales with confidence. */
export const KIND_COLORS: Record<Kind, string> = {
  fact: "#7a93c9",
  event: "#63b3b0",
  person: "#d98aa2",
  preference: "#e0a84a",
  routine: "#8fb98a",
  style: "#a48ad4",
  summary: "#a8a29b",
};

// Pedestals and belief shapes
export const PEDESTAL_HEIGHT = 0.9;
export const PEDESTAL_RADIUS = 0.2;
export const PEDESTAL_CAP = 0.5;
/** Half extent of a belief shape; every kind fits in a ~0.44 m cube. */
export const BELIEF_SIZE = 0.22;
/** Low-confidence beliefs sink this far into their pedestal. */
export const LOW_CONFIDENCE_SINK = 0.1;
export const MIN_BELIEF_OPACITY = 0.35;

// Paintings
export const PAINTING_WIDTH = 1.0;
export const PAINTING_HEIGHT = 0.62;
export const FRAME_BORDER = 0.04;
export const FRAME_DEPTH = 0.05;
/** Blur radius in UV units at clarity 0. */
export const MAX_BLUR_RADIUS = 0.05;
/** After a recall pulse the painting stays sharp, then eases back to its clarity blur. */
export const SHARPEN_HOLD_MS = 900;
export const SHARPEN_FADE_MS = 1200;

// Procedure tables
export const TABLE_HEIGHT = 0.78;
export const TABLE_WIDTH = 1.9;
export const TABLE_DEPTH = 1.0;
export const TABLE_TOP_THICKNESS = 0.06;
export const STEP_CARD_WIDTH = 0.36;
export const STEP_CARD_HEIGHT = 0.26;
export const MAX_STEP_CARDS = 12;

// Archive cases
export const CASE_SIZE = 0.6;
export const CASE_BASE_HEIGHT = 0.5;
export const CASE_BASE_WIDTH = 0.5;

// Plaques
export const PLAQUE_WIDTH = 0.26;
export const PLAQUE_HEIGHT = 0.06;
