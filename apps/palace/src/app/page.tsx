import { PalaceClient } from "./_palace/PalaceClient";

/** The palace: a full-viewport WebGL scene, so the whole thing is loaded client-side only. */
export default function Home() {
  return <PalaceClient />;
}
