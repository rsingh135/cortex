/** Thrown by every stub so a missing implementation fails loudly and names itself. */
export class NotImplemented extends Error {
  constructor(module: string, detail?: string) {
    super(`${module}: not implemented${detail ? ` (${detail})` : ""}. See docs/spec.md.`);
    this.name = "NotImplemented";
  }
}
