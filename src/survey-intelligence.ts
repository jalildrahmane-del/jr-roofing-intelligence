import type { RecordItem } from "./model.ts";
import { current } from "./tender.ts";

export type RoofEvidenceSummary = {
  roofId: string;
  name: string;
  area: number | null;
  condition: string;
  defects: number;
  photos: number;
  unphotographedDefects: number;
  gaps: string[];
};

/** Audit-style evidence indicators only; no engineering or access approval is inferred. */
export function roofEvidenceSummary(records: RecordItem[]): RoofEvidenceSummary[] {
  const roofs = current(records, "roof");
  const defects = current(records, "defect");
  const photos = current(records, "photo");
  return roofs.map(roof => {
    const id = String(roof.data.entityId || roof.id);
    const linkedDefects = defects.filter(d => d.data.roofId === id);
    const linkedPhotos = photos.filter(p => p.data.roofId === id || linkedDefects.some(d => p.data.defectId === (d.data.entityId || d.id)));
    const unphotographedDefects = linkedDefects.filter(d => !photos.some(p => p.data.defectId === (d.data.entityId || d.id))).length;
    const rawArea = Number(roof.data.area);
    const area = Number.isFinite(rawArea) && rawArea > 0 ? rawArea : null;
    const gaps: string[] = [];
    if (!area) gaps.push("Measured area missing");
    if (!String(roof.data.access || "").trim()) gaps.push("Access restrictions not recorded");
    if (!String(roof.data.limitations || "").trim()) gaps.push("Survey limitations not recorded");
    if (!String(roof.data.drainage || "").trim()) gaps.push("Drainage observations not recorded");
    if (!linkedPhotos.length) gaps.push("No photographic evidence linked to roof");
    if (unphotographedDefects) gaps.push(`${unphotographedDefects} defect${unphotographedDefects === 1 ? "" : "s"} without linked photograph`);
    return {
      roofId: id, name: String(roof.data.name || "Unnamed roof"), area,
      condition: String(roof.data.condition || "Not assessed"),
      defects: linkedDefects.length, photos: linkedPhotos.length, unphotographedDefects, gaps,
    };
  });
}
