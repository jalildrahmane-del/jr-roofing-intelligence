import { readFileSync } from "node:fs";
import { Store } from "../server/store.ts";
import { saveRecord } from "../server/index.ts";
import type { User } from "../src/model.ts";
export const today = () => new Date().toISOString().slice(0, 10);
export const future = () =>
  new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
export const roofData = {
  name: "Main warehouse",
  area: "100",
  pitch: "5",
  covering: "Standing seam metal",
  structure: "Steel purlins - capacity not verified",
  installed: "Unknown",
  surveyDate: today(),
  surveyor: "Synthetic test surveyor",
  access: "Visual inspection from safe access platform only",
  condition: "Poor",
  leaks: "Unknown",
  insulation: "Thickness not verified",
  drainage: "Outlet observations need closer inspection",
  observations:
    "Synthetic scenario: corrosion, failed repairs and rooflight detailing require investigation.",
  limitations:
    "Visual inspection only. No core samples, structural capacity or thermal compliance verified.",
};
export const materialData = {
  name: "Synthetic test roof panel",
  manufacturer: "Test manufacturer (not a real product)",
  category: "Roof covering",
  unit: "m²",
  sourceUrl: "https://example.invalid/test-datasheet",
  sourceReference: "SYNTHETIC-DATASHEET-01",
  sourceRevision: "TEST revision A",
  sourceDate: today(),
  validUntil: future(),
  properties:
    "Synthetic example only. λ values require product-specific evidence. No performance or suitability approved.",
  rate: "20.00",
  rateSource: "Synthetic rate for arithmetic tests only",
  rateDate: today(),
};
export function fixture(path = ":memory:") {
  const store = new Store(path);
  store.addUser("author", "synthetic-test-password", "manager");
  store.addUser("reviewer", "synthetic-test-password", "manager");
  store.addUser("viewer", "synthetic-test-password", "viewer");
  store.addUser("worker", "synthetic-test-password", "worker");
  const user = (name: string) =>
    store.user(store.login(name, "synthetic-test-password")!)!;
  const author = user("author"),
    reviewer = user("reviewer"),
    viewer = user("viewer"),
    worker = user("worker"),
    project = store.project(author, {
      name: "Synthetic multi-roof tender",
      client: "Test client",
      address: "Synthetic commercial facility - not a real inspection",
      area: 194,
      type: "Commercial",
      roof: "Mixed",
    });
  const save = (kind: string, data: any, who: User = author) =>
    store.transaction(() => saveRecord(store, who, project.id, kind, data));
  const roof = save("roof", roofData),
    annexe = save("roof", { ...roofData, name: "Annexe", area: 94 });
  const defect = save("defect", {
    roofId: roof.data.entityId,
    category: "Corrosion / perforation",
    severity: "High",
    location: "Ridge grid A1",
    quantity: 5,
    unit: "m",
    description: "Synthetic corrosion evidence",
    action: "Investigate fragility before access; confirm repair design",
    assumptions: "No structural assessment. No access authorisation.",
  });
  const image =
    "data:image/png;base64," +
    readFileSync("tests/fixtures/roof.png").toString("base64");
  const photo = save("photo", {
    roofId: roof.data.entityId,
    defectId: defect.data.entityId,
    takenAt: today(),
    caption: "Synthetic roof image with marked defect",
    image,
    gps: {
      lat: 51.88,
      lng: -0.37,
      accuracy: 8,
      observedAt: new Date().toISOString(),
    },
    annotations: [
      { x: 0.32, y: 0.35, w: 0.2, h: 0.25, label: "Synthetic defect area" },
    ],
  });
  const material = save("material", materialData);
  const lines = [
    {
      description: "Synthetic roof covering",
      category: "material",
      unit: "m²",
      basis: "roof-area",
      roofId: roof.data.entityId,
      materialId: material.data.entityId,
      quantity: 100,
      waste: 10,
      rate: "20.00",
      rateSource: "Synthetic test quote",
      rateDate: today(),
    },
    ...(
      [
        ["labour", "Labour", 16, 25, "hour"],
        ["plant", "Access plant", 2, 150, "day"],
        ["scaffold", "Scaffold", 1, 500, "item"],
        ["prelims", "Preliminaries", 1, 100, "item"],
      ] as const
    ).map(([category, description, quantity, rate, unit]) => ({
      description,
      category,
      quantity,
      rate: String(rate),
      unit,
      basis: "measured",
      roofId: "",
      materialId: "",
      waste: 0,
      rateSource: "Synthetic test quote",
      rateDate: today(),
    })),
  ];
  const estimateData = {
    title: "Option A - synthetic overcladding",
    scope: "Synthetic scope for calculation and report checks only",
    exclusions:
      "Structural strengthening, engineering and statutory approvals excluded",
    assumptions: "All rates synthetic. Re-measure before any live use.",
    paymentTerms: "Test terms - no commercial offer",
    validUntil: future(),
    lines,
    contingency: 10,
    margin: 20,
    vat: 20,
  };
  const estimate = save("estimate", estimateData);
  return {
    store,
    save,
    author,
    reviewer,
    viewer,
    worker,
    project,
    roof,
    annexe,
    defect,
    photo,
    material,
    estimate,
    estimateData,
    image,
  };
}
