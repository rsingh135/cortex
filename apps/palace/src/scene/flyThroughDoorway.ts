/** Fly through a doorway: into the room, or (when already inside it) back out to the atrium. */
import { usePalaceStore } from "@/lib/store";
import { roomLayoutFor } from "@/lib/layout";
import { flyToPose } from "./flyBus";
import { atriumEntryPose, roomEntryPose, type Doorway } from "./geometry";

export function flyThroughDoorway(doorway: Doorway, fromInside: boolean): void {
  if (fromInside) {
    const pose = atriumEntryPose(doorway);
    flyToPose(pose.position, pose.target);
    return;
  }
  const room = roomLayoutFor(usePalaceStore.getState().layout, doorway.room);
  const pose = roomEntryPose(room);
  flyToPose(pose.position, pose.target);
}
