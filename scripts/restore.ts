import {
  copyFileSync,
  existsSync,
  chmodSync,
  constants,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { Store } from "../server/store.ts";
import { verifyDatabase } from "./verify-database.ts";
export function restoreDatabase(source: string, destination: string) {
  if (resolve(source) === resolve(destination) || existsSync(destination))
    throw Error("Restore destination must be a new file");
  verifyDatabase(source);
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  chmodSync(destination, 0o600);
  try {
    const store = new Store(destination);
    try {
      store.transaction(() => {
        store.db.exec("DELETE FROM sessions");
        store.audit("local-operator", "database.restore", {
          sessionsRevoked: true,
        });
      });
    } finally {
      store.close();
    }
    verifyDatabase(destination);
  } catch (e) {
    unlinkSync(destination);
    throw e;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  if (!process.argv[2] || !process.argv[3])
    throw Error(
      "Usage: node scripts/restore.ts backup.sqlite NEW-restored.sqlite",
    );
  restoreDatabase(process.argv[2], process.argv[3]);
  console.log("Verified restore completed; previous sessions revoked.");
}
