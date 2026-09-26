/**
 * Saves and restores the demo database so the five beats can be rehearsed from a known state.
 * Works on every collection in the database with Extended JSON, so binary image levels, dates and
 * ObjectIds survive the round trip. Indexes are re-created from the saved index specs.
 *
 *   pnpm reset-demo-db --save snapshots/day24          # dump ATLAS_DB to a folder
 *   pnpm reset-demo-db --restore snapshots/day24       # wipe ATLAS_DB and load the folder
 *   pnpm reset-demo-db --restore snapshots/day24 --db cortex_rehearsal   # into another database
 *
 * Restore is destructive for the target database and asks for --yes unless the target name
 * contains "rehearsal" or "demo".
 */
import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EJSON } from "bson";
import { MongoClient, type Db, type Document, type IndexDescription } from "mongodb";

interface Manifest {
  db: string;
  savedAt: string;
  collections: Array<{ name: string; count: number; indexes: IndexDescription[] }>;
}

const SEARCH_INDEX_KEYS = new Set(["_id_"]);

export async function saveSnapshot(db: Db, dir: string): Promise<Manifest> {
  mkdirSync(dir, { recursive: true });
  const manifest: Manifest = { db: db.databaseName, savedAt: new Date().toISOString(), collections: [] };
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  for (const name of names.sort()) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    const indexes = (await col.indexes()).filter((i) => !SEARCH_INDEX_KEYS.has(String(i.name))).map(({ v: _v, ns: _ns, ...spec }) => spec as IndexDescription);
    writeFileSync(join(dir, `${name}.ejson`), EJSON.stringify(docs, { relaxed: false }));
    manifest.collections.push({ name, count: docs.length, indexes });
  }
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function restoreSnapshot(db: Db, dir: string): Promise<Manifest> {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
  await db.dropDatabase();
  for (const entry of manifest.collections) {
    const file = join(dir, `${entry.name}.ejson`);
    const docs = EJSON.parse(readFileSync(file, "utf8"), { relaxed: false }) as Document[];
    const col = db.collection(entry.name);
    if (docs.length) await col.insertMany(docs, { ordered: true });
    else await db.createCollection(entry.name);
    if (entry.indexes.length) await col.createIndexes(entry.indexes);
  }
  return manifest;
}

function describe(manifest: Manifest): string {
  return manifest.collections.map((c) => `${c.name}=${c.count}`).join(", ");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const uri = process.env["ATLAS_URI"];
  if (!uri) throw new Error("ATLAS_URI not set");
  const dbName = arg("--db") ?? process.env["ATLAS_DB"] ?? "cortex";
  const save = arg("--save");
  const restore = arg("--restore");
  if (!save && !restore) throw new Error("pass --save <dir> or --restore <dir>");
  if (restore && !existsSync(join(restore, "manifest.json"))) throw new Error(`no manifest.json in ${restore}`);
  if (restore && !argv.includes("--yes") && !/rehearsal|demo/.test(dbName)) {
    throw new Error(`restore wipes database "${dbName}"; pass --yes to confirm`);
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    if (save) {
      const m = await saveSnapshot(db, save);
      console.log(`saved ${dbName} -> ${save}: ${describe(m)} (${readdirSync(save).length} files)`);
    }
    if (restore) {
      const m = await restoreSnapshot(db, restore);
      console.log(`restored ${restore} -> ${dbName}: ${describe(m)}`);
    }
  } finally {
    await client.close();
  }
}

if (process.argv[1] && /reset-demo-db\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
