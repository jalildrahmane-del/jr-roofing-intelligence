import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "../server/store.ts";
import { saveRecord } from "../server/index.ts";
import { stagingConfig } from "../server/staging.ts";
export function seedStaging(path: string, name: string, password: string) {
  if (existsSync(path))
    throw Error(
      "Seed requires a new database; existing data is never overwritten",
    );
  const store = new Store(path);
  try {
    store.addUser(name, password, "manager", "Synthetic JR Owner Staging");
    const owner = store.user(store.login(name, password)!)!;
    store.db.exec("DELETE FROM sessions");
    const project = store.project(owner, {
      name: "[SYNTHETIC] Owner review — warehouse roof",
      client: "Synthetic demonstration client",
      address: "Synthetic facility — no real site address",
      area: 194,
      type: "Commercial",
      roof: "Mixed",
    });
    const save = (kind: string, data: any) =>
        store.transaction(() =>
          saveRecord(store, owner, project.id, kind, data),
        ),
      today = new Date().toISOString().slice(0, 10);
    for (const [name, area] of [
      ["Main roof", 100],
      ["Annexe", 94],
    ])
      save("roof", {
        name,
        area,
        pitch: 5,
        covering: "Standing seam metal",
        structure: "Synthetic structure — capacity unverified",
        installed: "Unknown",
        surveyDate: today,
        surveyor: "Synthetic surveyor",
        access: "Synthetic visual inspection only",
        condition: "Poor",
        leaks: "Unknown",
        insulation: "Unverified",
        drainage: "Synthetic outlet observations",
        observations:
          "Synthetic corrosion and repair observations for software review only",
        limitations:
          "No real inspection, product suitability, engineering acceptance or work permission",
      });
    const roof = store.snapshot(owner).records.find((r) => r.kind === "roof")!;
    save("photo", {
      roofId: roof.data.entityId,
      defectId: "",
      takenAt: today,
      caption:
        "Synthetic one-pixel evidence placeholder, not a real site photograph",
      annotations: [],
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNIm7n7PwAF3QK6Nq89lgAAAABJRU5ErkJggg==",
    });
    save("load", { thickness: 18, density: 650, area: 94, other: 0 });
    save("document", {
      type: "survey",
      title: "SYNTHETIC draft survey for owner review",
    });
    store.transaction(() =>
      store.append(owner, project.id, "stagingDataset", {
        marker: "synthetic-only-v1",
        notice: "No real customer data or safety approvals",
      }),
    );
  } catch (e) {
    store.close();
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(path + suffix, { force: true });
    throw e;
  }
  store.close();
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const config = stagingConfig();
  if (!config) throw Error("Owner staging configuration required");
  const name = process.argv[2];
  if (!Object.values(config.accounts).includes(name))
    throw Error("Use an approved mapped account name");
  seedStaging(process.env.JR_DB!, name, readFileSync(0, "utf8").trim());
  console.log("Synthetic staging database prepared; no server started");
}
