import { chmodSync, linkSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Prepare and verify a SQLite file privately, then publish its name atomically. */
export function publishSnapshot(destination: string, prepare: (candidate: string) => void) {
  const target = resolve(destination);
  const staging = mkdtempSync(join(dirname(target), ".jr-snapshot-"));
  const candidate = join(staging, "snapshot.sqlite");
  try {
    prepare(candidate);
    chmodSync(candidate, 0o600);
    try {
      // A hard link on the same volume never overwrites an existing entry.
      linkSync(candidate, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw Error("Snapshot destination must be a new file", { cause: error });
      throw Error("Could not publish snapshot. Use a private destination on a filesystem with hard link support.", { cause: error });
    }
  } finally {
    rmSync(staging, { recursive: true, force: true, maxRetries: 3 });
  }
}
