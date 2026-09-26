import { ulid } from "ulid";

/** Every `_id` in Cortex is a ULID string. */
export const newId = (): string => ulid();
