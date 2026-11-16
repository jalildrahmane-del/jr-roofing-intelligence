import { positive, text } from "./model.ts";
import type { RecordItem } from "./model.ts";
export const categories = [
  "material",
  "labour",
  "plant",
  "scaffold",
  "prelims",
] as const;
export const units = ["m²", "m", "each", "hour", "day", "item"] as const;
export type CostCategory = (typeof categories)[number];
export type LineInput = {
  description: string;
  category: CostCategory;
  unit: string;
  basis: "measured" | "roof-area";
  roofId: string;
  materialId: string;
  quantity: string | number;
  waste: string | number;
  rate: string | number;
  rateSource: string;
  rateDate: string;
};
export type CostLine = LineInput & {
  quantityMilli: number;
  ratePence: number | null;
  extendedPence: number | null;
  roofRevision: string;
  materialRevision: string;
};
export type Pricing = {
  lines: CostLine[];
  contingency: number;
  margin: number;
  vat: number;
  complete: boolean;
  subtotals: Record<CostCategory, number>;
  directPence: number | null;
  contingencyPence: number | null;
  costPence: number | null;
  profitPence: number | null;
  netPence: number | null;
  vatPence: number | null;
  grossPence: number | null;
};
export function current(records: RecordItem[], kind: string) {
  const m = new Map<string, RecordItem>();
  for (const r of records)
    if (r.kind === kind) m.set(r.data.entityId || r.id, r);
  return [...m.values()];
}
export function optional(value: unknown, max = 10000) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > max)
    throw Error("Invalid text field");
  return value.trim();
}
export function choice(
  value: unknown,
  values: readonly string[],
  label: string,
) {
  if (typeof value !== "string" || !values.includes(value))
    throw Error(`Invalid ${label}`);
  return value;
}
export function decimal(
  value: unknown,
  label: string,
  max: number,
  places = 3,
) {
  if (
    !["string", "number"].includes(typeof value) ||
    !/^\d+(\.\d+)?$/.test(String(value)) ||
    (String(value).split(".")[1]?.length || 0) > places
  )
    throw Error(
      `${label}: use a non-negative number with up to ${places} decimal places`,
    );
  const n = positive(value, label, true);
  if (n > max) throw Error(`${label} exceeds ${max}`);
  return n;
}
export function date(value: unknown, label: string, empty = false) {
  if (empty && (value == null || value === "")) return "";
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw Error(`${label}: enter a valid date`);
  return value;
}
export function observedDate(value: unknown, label: string, empty = false) {
  const d = date(value, label, empty);
  if (d && d > new Date().toISOString().slice(0, 10))
    throw Error(`${label} cannot be in the future`);
  return d;
}
export function money(value: unknown, label: string) {
  if (value === "" || value == null) return null;
  return Math.round(decimal(value, label, 10000000, 2) * 100);
}
export const pounds = (p: number | null | undefined) =>
  p == null
    ? "Unpriced"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(p / 100);

const BASIS_POINTS = 10_000n;
const MAX_NET_PENCE = 100_000_000_000;

function toBasisPoints(percent: number): bigint {
  return BigInt(Math.round(percent * 100));
}

function roundQuotient(numerator: bigint, denominator: bigint): number {
  return Number((numerator + denominator / 2n) / denominator);
}

function quantityWithWaste(quantity: number, waste: number): number {
  // Roof areas can have more than three decimal places. Apply waste before
  // rounding to thousandths, using the stored decimal value for exact ties.
  const [coefficient, exponent = "0"] = String(quantity).split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const numerator =
    BigInt(whole + fraction) * (BASIS_POINTS + toBasisPoints(waste));
  const scale = fraction.length - Number(exponent) + 1;
  return scale < 0
    ? Number(numerator * 10n ** BigInt(-scale))
    : roundQuotient(numerator, 10n ** BigInt(scale));
}

export function price(
  lines: CostLine[],
  contingency: unknown,
  margin: unknown,
  vat: unknown,
): Pricing {
  const c = decimal(contingency, "Contingency", 100, 2),
    m = decimal(margin, "Sales margin", 95, 2),
    v = decimal(vat, "VAT", 100, 2);
  const subtotals = {
    material: 0,
    labour: 0,
    plant: 0,
    scaffold: 0,
    prelims: 0,
  };
  for (const l of lines)
    if (l.extendedPence !== null) subtotals[l.category] += l.extendedPence;
  if (Object.values(subtotals).some((subtotal) => !Number.isSafeInteger(subtotal)))
    throw Error("Estimate exceeds the supported monetary range");
  const complete = lines.length > 0 && lines.every((l) => l.ratePence !== null),
    direct = complete
      ? Object.values(subtotals).reduce((a, b) => a + b, 0)
      : null;
  if (direct !== null && direct > MAX_NET_PENCE)
    throw Error("Estimate exceeds the supported monetary range");
  const contingencyPence =
      direct === null
        ? null
        : roundQuotient(BigInt(direct) * toBasisPoints(c), BASIS_POINTS),
    cost = direct === null ? null : direct + contingencyPence!,
    net = cost === null
      ? null
      : roundQuotient(BigInt(cost) * BASIS_POINTS, BASIS_POINTS - toBasisPoints(m));
  if (net !== null && net > MAX_NET_PENCE)
    throw Error("Estimate exceeds the supported monetary range");
  const vatPence = net === null
    ? null
    : roundQuotient(BigInt(net) * toBasisPoints(v), BASIS_POINTS);
  return {
    lines,
    contingency: c,
    margin: m,
    vat: v,
    complete,
    subtotals,
    directPence: direct,
    contingencyPence,
    costPence: cost,
    profitPence: net === null ? null : net - cost!,
    netPence: net,
    vatPence,
    grossPence: net === null ? null : net + vatPence!,
  };
}
export function calculate(
  lines: unknown,
  contingency: unknown,
  margin: unknown,
  vat: unknown,
  roofs: RecordItem[],
  materials: RecordItem[],
): Pricing {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100)
    throw Error("Add between 1 and 100 cost lines");
  const normal = lines.map((l: any): CostLine => {
    if (!l || typeof l !== "object") throw Error("Invalid cost line");
    const description = text(l.description, "Line description", 500),
      category = choice(
        l.category,
        categories,
        "cost category",
      ) as CostCategory,
      unit = choice(l.unit, units, "unit"),
      basis = choice(l.basis, ["measured", "roof-area"], "quantity basis") as
        | "measured"
        | "roof-area";
    const roofId = optional(l.roofId, 100),
      materialId = optional(l.materialId, 100),
      roof = roofs.find((r) => r.data.entityId === roofId),
      material = materials.find((r) => r.data.entityId === materialId);
    if (roofId && !roof) throw Error("Cost line roof not found");
    if (materialId && !material) throw Error("Cost line material not found");
    if (material && unit !== material.data.unit)
      throw Error("Line unit must match the selected material");
    if (basis === "roof-area" && (!roof || unit !== "m²"))
      throw Error("Roof area takeoff needs a roof and m² unit");
    const raw =
        basis === "roof-area"
          ? roof!.data.area
          : decimal(l.quantity, "Quantity", 10000000),
      waste = decimal(l.waste, "Waste", 100, 2);
    if (raw <= 0) throw Error("Quantity must be greater than zero");
    const quantityMilli = quantityWithWaste(raw, waste),
      ratePence = money(l.rate, "Unit rate"),
      rateSource = optional(l.rateSource, 500),
      rateDate = observedDate(l.rateDate, "Rate date", true);
    if (ratePence !== null && (!rateSource || !rateDate))
      throw Error("Every entered rate needs its source/reference and date");
    if (!Number.isSafeInteger(quantityMilli))
      throw Error("Cost line exceeds supported numeric range");
    const extendedPence =
      ratePence === null
        ? null
        : roundQuotient(BigInt(quantityMilli) * BigInt(ratePence), 1000n);
    if (extendedPence !== null && !Number.isSafeInteger(extendedPence))
      throw Error("Cost line exceeds supported numeric range");
    return {
      description,
      category,
      unit,
      basis,
      roofId,
      materialId,
      quantity: String(raw),
      waste,
      rate: ratePence === null ? "" : (ratePence / 100).toFixed(2),
      rateSource,
      rateDate,
      quantityMilli,
      ratePence,
      extendedPence,
      roofRevision: roof?.id || "",
      materialRevision: material?.id || "",
    };
  });
  return price(normal, contingency, margin, vat);
}

export function estimateWarnings(
  estimate: RecordItem,
  roofs: RecordItem[],
  materials: RecordItem[],
) {
  const warnings: string[] = [];
  for (const line of estimate.data.pricing.lines) {
    if (
      line.roofId &&
      roofs.find((r) => r.data.entityId === line.roofId)?.id !==
        line.roofRevision
    )
      warnings.push(
        "Roof measurements changed since this estimate. Revise the option to reconcile takeoff.",
      );
    if (
      line.materialId &&
      materials.find((r) => r.data.entityId === line.materialId)?.id !==
        line.materialRevision
    )
      warnings.push(
        "Material source changed since this estimate. Review and revise the option.",
      );
  }
  return [...new Set(warnings)];
}
