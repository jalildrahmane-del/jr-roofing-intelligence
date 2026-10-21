import React, { useEffect, useState, useRef } from "react";
import type { Project, RecordItem, User } from "./model.ts";
import {
  current,
  units,
  categories,
  calculate,
  pounds,
  estimateWarnings,
} from "./tender.ts";
import type { LineInput, Pricing } from "./tender.ts";
import { api } from "./api.ts";
import { compareTenderOptions } from "./commercial.ts";
import "./commercial.css";
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[] | string[];
  optional?: boolean;
  value?: any;
  placeholder?: string;
};
const today = () => new Date().toISOString().slice(0, 10);
function Input({ field, values }: { field: Field; values: any }) {
  const {
      name,
      label,
      type = "text",
      options,
      optional = false,
      placeholder,
    } = field,
    value = values[name] ?? field.value ?? "";
  return (
    <label>
      {label}
      {options ? (
        <select
          aria-label={label}
          name={name}
          required={!optional}
          defaultValue={value}
        >
          <option value="">Select…</option>
          {options.map((o: any) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          aria-label={label}
          name={name}
          required={!optional}
          defaultValue={value}
          placeholder={placeholder}
          maxLength={10000}
        />
      ) : (
        <input
          aria-label={label}
          name={name}
          type={type}
          defaultValue={value}
          required={!optional}
          step={type === "number" ? "any" : undefined}
          min={type === "number" ? 0 : undefined}
          placeholder={placeholder}
          maxLength={1000}
        />
      )}
    </label>
  );
}
function Editor({
  title,
  fields,
  values = {},
  submit,
  onSave,
  onCancel,
}: {
  title: string;
  fields: Field[];
  values?: any;
  submit: string;
  onSave: (d: any) => Promise<any>;
  onCancel?: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section>
      <h2>{title}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          setError("");
          try {
            await onSave(Object.fromEntries(new FormData(form)));
            if (!values.entityId) form.reset();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          {fields.map((f) => (
            <Input key={f.name} field={f} values={values} />
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy}>{busy ? "Saving…" : submit}</button>
        {onCancel && (
          <button type="button" className="quiet" onClick={onCancel}>
            Cancel revision
          </button>
        )}
      </form>
    </section>
  );
}
export function Journey({ records }: { records: RecordItem[] }) {
  return (
    <div className="journey">
      <a href="#survey">
        <strong>{current(records, "roof").length}</strong> Roof surveys →
      </a>
      <a href="#materials">
        <strong>{current(records, "material").length}</strong> Material sources
        →
      </a>
      <a href="#estimating">
        <strong>{current(records, "estimate").length}</strong> Tender options →
      </a>
      <span>
        <strong>{records.filter((r) => r.kind === "approval").length}</strong>{" "}
        Approved snapshots
      </span>
    </div>
  );
}
const roofFields: Field[] = [
  { name: "name", label: "Roof name / asset" },
  { name: "area", label: "Measured roof area (m²)", type: "number" },
  { name: "pitch", label: "Roof pitch (degrees)", type: "number" },
  {
    name: "covering",
    label: "Roof covering",
    options: [
      "Unknown",
      "Standing seam metal",
      "Profiled metal sheet",
      "Single-ply membrane",
      "Bituminous felt",
      "Liquid waterproofing",
      "Slate / tiles",
      "Green roof",
      "Mixed / other",
    ],
  },
  { name: "structure", label: "Primary structure / unknown" },
  { name: "installed", label: "Installation year / source", optional: true },
  { name: "surveyDate", label: "Survey date", type: "date", value: today() },
  { name: "surveyor", label: "Surveyor" },
  { name: "access", label: "Access method and restrictions", type: "textarea" },
  {
    name: "condition",
    label: "Condition",
    options: ["Not assessed", "Good", "Fair", "Poor", "Critical"],
  },
  { name: "leaks", label: "Reported leaks", options: ["Unknown", "Yes", "No"] },
  {
    name: "insulation",
    label: "Insulation observations / source",
    optional: true,
  },
  { name: "drainage", label: "Drainage observations", type: "textarea" },
  { name: "observations", label: "Survey observations", type: "textarea" },
  {
    name: "limitations",
    label: "Access limitations and technical assumptions",
    type: "textarea",
  },
];
const materialFields: Field[] = [
  { name: "name", label: "Product / material" },
  { name: "manufacturer", label: "Manufacturer / generic" },
  {
    name: "category",
    label: "Material category",
    options: [
      "Roof covering",
      "Insulation",
      "Deck / substrate",
      "Membrane / waterproofing",
      "Fixings / sealants",
      "Flashings / trims",
      "Rooflights",
      "Drainage",
      "Safety / access",
      "Other",
    ],
  },
  { name: "unit", label: "Material unit", options: [...units] },
  {
    name: "sourceUrl",
    label: "Manufacturer source URL (HTTPS)",
    type: "url",
    optional: true,
  },
  { name: "sourceReference", label: "Source document / reference" },
  { name: "sourceRevision", label: "Source revision / edition" },
  { name: "sourceDate", label: "Source checked date", type: "date" },
  {
    name: "validUntil",
    label: "Source review due date",
    type: "date",
    optional: true,
  },
  {
    name: "properties",
    label: "Specification, properties and limitations",
    type: "textarea",
  },
  {
    name: "rate",
    label: "Budget unit rate (£, optional)",
    type: "number",
    optional: true,
  },
  {
    name: "rateSource",
    label: "Rate source / quotation reference",
    optional: true,
  },
  { name: "rateDate", label: "Rate date", type: "date", optional: true },
];
const emptyLine = (): LineInput => ({
  description: "",
  category: "material",
  unit: "m²",
  basis: "measured",
  roofId: "",
  materialId: "",
  quantity: "",
  waste: "0",
  rate: "",
  rateSource: "",
  rateDate: "",
});
function Totals({ pricing }: { pricing: Pricing }) {
  return (
    <div className="totals">
      <p className={!pricing.complete ? "warning" : ""}>
        {pricing.complete
          ? "All lines priced"
          : "Unpriced: enter a rate, source and date for every line. Missing rates are not zero."}
      </p>
      <dl>
        {categories.map((c) => (
          <React.Fragment key={c}>
            <dt>{c} subtotal</dt>
            <dd>{pounds(pricing.subtotals[c])}</dd>
          </React.Fragment>
        ))}
        {[
          ["Direct cost", pricing.directPence],
          ["Contingency", pricing.contingencyPence],
          ["Cost including contingency", pricing.costPence],
          ["Profit (sales margin)", pricing.profitPence],
          ["Net quotation", pricing.netPence],
          ["VAT", pricing.vatPence],
          ["Total including VAT", pricing.grossPence],
        ].map(([k, v]) => (
          <React.Fragment key={String(k)}>
            <dt>{k}</dt>
            <dd>{pounds(v as number | null)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
function EstimateEditor({
  record,
  roofs,
  materials,
  onSave,
  onCancel,
}: {
  record?: RecordItem;
  roofs: RecordItem[];
  materials: RecordItem[];
  onSave: (d: any) => Promise<any>;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState<LineInput[]>(
      record?.data.pricing.lines.map((l: LineInput) => ({ ...l })) || [
        emptyLine(),
      ],
    ),
    [contingency, setContingency] = useState(
      record?.data.pricing.contingency ?? 0,
    ),
    [margin, setMargin] = useState(record?.data.pricing.margin ?? 0),
    [vat, setVat] = useState(record?.data.pricing.vat ?? 0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  let pricing: Pricing | undefined,
    pricingError = "";
  try {
    pricing = calculate(lines, contingency, margin, vat, roofs, materials);
  } catch (e) {
    pricingError = (e as Error).message;
  }
  function update(i: number, patch: Partial<LineInput>) {
    setLines((a) => a.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  }
  const values = record?.data || {};
  return (
    <section>
      <h2>{record ? "Revise tender option" : "New tender option"}</h2>
      <p>
        Rates are entered by you. Nothing is filled from historic report
        budgets. Sales margin is profit divided by selling price, not a markup
        on cost.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = Object.fromEntries(new FormData(form));
          setError("");
          setBusy(true);
          try {
            await onSave({
              ...d,
              lines,
              contingency,
              margin,
              vat,
              previousId: record?.id,
            });
            setLines([emptyLine()]);
            if (!record) {
              form.reset();
              setContingency(0);
              setMargin(0);
              setVat(0);
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          {[
            { name: "title", label: "Option title" },
            { name: "scope", label: "Included scope", type: "textarea" },
            { name: "exclusions", label: "Exclusions", type: "textarea" },
            {
              name: "assumptions",
              label: "Pricing and technical assumptions",
              type: "textarea",
            },
            {
              name: "paymentTerms",
              label: "Commercial / payment terms",
              type: "textarea",
            },
            {
              name: "validUntil",
              label: "Quotation valid until",
              type: "date",
            },
          ].map((f) => (
            <Input key={f.name} field={f} values={values} />
          ))}
        </div>
        {lines.map((l, i) => (
          <fieldset className="cost-line" key={i}>
            <legend>Cost line {i + 1}</legend>
            <div className="fields">
              <label>
                Description {i + 1}
                <input
                  value={l.description}
                  required
                  onChange={(e) => update(i, { description: e.target.value })}
                />
              </label>
              <label>
                Cost category {i + 1}
                <select
                  aria-label={"Cost category " + (i + 1)}
                  value={l.category}
                  onChange={(e) =>
                    update(i, {
                      category: e.target.value as LineInput["category"],
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Material source {i + 1}
                <select
                  aria-label={"Material source " + (i + 1)}
                  value={l.materialId}
                  onChange={(e) => {
                    const m = materials.find(
                      (x) => x.data.entityId === e.target.value,
                    );
                    update(i, {
                      materialId: e.target.value,
                      ...(m
                        ? {
                            unit: m.data.unit,
                            rate: m.data.rate,
                            rateSource: m.data.rateSource,
                            rateDate: m.data.rateDate,
                          }
                        : {}),
                    });
                  }}
                >
                  <option value="">Custom line / no catalogue item</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.data.entityId}>
                      {m.data.name} · revision {m.data.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Roof for cost line {i + 1}
                <select
                  aria-label={"Roof for cost line " + (i + 1)}
                  value={l.roofId}
                  onChange={(e) => update(i, { roofId: e.target.value })}
                >
                  <option value="">Project-wide cost</option>
                  {roofs.map((r) => (
                    <option key={r.id} value={r.data.entityId}>
                      {r.data.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity basis {i + 1}
                <select
                  aria-label={"Quantity basis " + (i + 1)}
                  value={l.basis}
                  onChange={(e) =>
                    update(i, { basis: e.target.value as LineInput["basis"] })
                  }
                >
                  <option value="measured">Measured quantity</option>
                  <option value="roof-area">Linked measured roof area</option>
                </select>
              </label>
              <label>
                Quantity {i + 1}
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  required={l.basis === "measured"}
                  disabled={l.basis === "roof-area"}
                  value={
                    l.basis === "roof-area"
                      ? roofs.find((r) => r.data.entityId === l.roofId)?.data
                          .area || ""
                      : l.quantity
                  }
                  onChange={(e) => update(i, { quantity: e.target.value })}
                />
              </label>
              <label>
                Unit {i + 1}
                <select
                  aria-label={"Unit " + (i + 1)}
                  value={l.unit}
                  onChange={(e) => update(i, { unit: e.target.value })}
                >
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
              <label>
                Waste % {i + 1}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={l.waste}
                  required
                  onChange={(e) => update(i, { waste: e.target.value })}
                />
              </label>
              <label>
                Unit rate (£) {i + 1}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.rate}
                  onChange={(e) => update(i, { rate: e.target.value })}
                  placeholder="Unpriced"
                />
              </label>
              <label>
                Rate source {i + 1}
                <input
                  value={l.rateSource}
                  onChange={(e) => update(i, { rateSource: e.target.value })}
                />
              </label>
              <label>
                Rate date {i + 1}
                <input
                  type="date"
                  value={l.rateDate}
                  onChange={(e) => update(i, { rateDate: e.target.value })}
                />
              </label>
            </div>
            {pricing && (
              <p>
                Takeoff: {pricing.lines[i]?.quantityMilli / 1000} {l.unit} ·
                line total {pounds(pricing.lines[i]?.extendedPence)}
              </p>
            )}
            <button
              type="button"
              className="quiet"
              disabled={lines.length === 1}
              onClick={() => setLines((a) => a.filter((_, n) => n !== i))}
            >
              Remove line {i + 1} from this revision
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="quiet"
          disabled={lines.length >= 100}
          onClick={() => setLines((a) => [...a, emptyLine()])}
        >
          Add cost line
        </button>
        <div className="fields">
          {[
            ["Contingency %", contingency, setContingency],
            ["Sales margin %", margin, setMargin],
            ["VAT %", vat, setVat],
          ].map(([label, value, set]) => (
            <label key={String(label)}>
              {label as string}
              <input
                type="number"
                step="0.01"
                min="0"
                max={label === "Sales margin %" ? 95 : 100}
                value={value as number}
                required
                onChange={(e) => (set as (v: any) => void)(e.target.value)}
              />
            </label>
          ))}
        </div>
        {pricing ? (
          <Totals pricing={pricing} />
        ) : (
          <p className="warning">{pricingError}</p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy}>
          {busy ? "Saving…" : "Save tender option"}
        </button>
        {record && (
          <button type="button" className="quiet" onClick={onCancel}>
            Cancel revision
          </button>
        )}
      </form>
    </section>
  );
}
async function photoData(file: File) {
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024)
    throw Error("Choose an image no larger than 20 MiB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const result = canvas.toDataURL("image/jpeg", 0.76);
  if (result.length > 1400000)
    throw Error("Compressed photo is too large. Choose a smaller image.");
  return result;
}
function Annotator({
  photo,
  onSave,
  onCancel,
}: {
  photo: RecordItem;
  onSave: (d: any) => Promise<any>;
  onCancel: () => void;
}) {
  const [annotations, setAnnotations] = useState<any[]>(photo.data.annotations),
    [label, setLabel] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [error, setError] = useState(""),
    start = useRef<any>(null);
  const point = (e: React.PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    };
  };
  return (
    <section>
      <h2>Annotate photograph</h2>
      <p>
        Enter a label, then drag a rectangle over the image. Existing evidence
        stays available in its earlier revision.
      </p>
      <label>
        Marked area label
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={200}
        />
      </label>
      <div
        className="annotation-surface"
        style={{ aspectRatio: `${photo.data.width}/${photo.data.height}` }}
      >
        <img
          src={"/api/evidence/" + photo.data.assetId}
          alt={photo.data.caption}
        />
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-label="Photo annotation surface"
          role="img"
          onPointerDown={(e) => {
            if (!label.trim())
              return setError("Enter a marked area label before drawing");
            start.current = point(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const end = point(e),
              s = start.current;
            setDraft({
              x: Math.min(s.x, end.x),
              y: Math.min(s.y, end.y),
              w: Math.abs(end.x - s.x),
              h: Math.abs(end.y - s.y),
              label: label.trim(),
            });
          }}
          onPointerUp={() => {
            if (draft && draft.w > 0.005 && draft.h > 0.005)
              setAnnotations((a) => [...a, draft]);
            start.current = null;
            setDraft(null);
          }}
        >
          {[...annotations, ...(draft ? [draft] : [])].map((a, i) => (
            <g key={i}>
              <rect
                x={a.x}
                y={a.y}
                width={a.w}
                height={a.h}
                fill="none"
                stroke="#f5a423"
                strokeWidth="0.006"
              />
              <text
                x={a.x + 0.008}
                y={a.y + 0.04}
                fontSize="0.035"
                fill="#f5a423"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ol>
        {annotations.map((a, i) => (
          <li key={i}>
            {a.label}{" "}
            <button
              className="quiet"
              onClick={() => setAnnotations((x) => x.filter((_, n) => n !== i))}
            >
              Remove mark {i + 1}
            </button>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        onClick={async () => {
          try {
            await onSave({
              ...photo.data,
              previousId: photo.id,
              annotations,
              gps: undefined,
            });
            onCancel();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Save photo annotation revision
      </button>
      <button className="quiet" onClick={onCancel}>
        Close annotation editor
      </button>
    </section>
  );
}
function Documents({
  records,
  user,
  onCreate,
  onApprove,
  type,
  estimates,
}: {
  records: RecordItem[];
  user: User;
  onCreate: (d: any) => Promise<any>;
  onApprove: (d: any) => Promise<any>;
  type: string;
  estimates: RecordItem[];
}) {
  const [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  const docs = records
    .filter((r) => r.kind === "document" && r.data.type === type)
    .slice()
    .reverse();
  return (
    <section>
      <h2>{type === "survey" ? "Survey report PDFs" : "Quotation PDFs"}</h2>
      <p>
        Create a fixed draft snapshot, download and review it. An independent
        manager may then approve that exact snapshot for issue. Changed evidence
        requires a new draft.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onCreate({
              ...Object.fromEntries(new FormData(e.currentTarget)),
              type,
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="fields">
          <label>
            Document title
            <input name="title" required maxLength={300} />
          </label>
          {type === "quotation" && (
            <label>
              Quotation option
              <select aria-label="Quotation option" name="estimateId" required>
                <option value="">Select option</option>
                {estimates.map((r) => (
                  <option key={r.id} value={r.data.entityId}>
                    {r.data.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button>
          Create {type === "survey" ? "survey report" : "quotation"} draft
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {docs.map((d) => {
        const a = records.find(
          (r) => r.kind === "approval" && r.data.documentId === d.id,
        );
        return (
          <article key={d.id}>
            <h3>{d.data.title}</h3>
            <p className="tag">
              {a ? "Approved for issue" : "Draft for review"} ·{" "}
              {new Date(d.createdAt).toLocaleString("en-GB")}
            </p>
            <p>
              Immutable snapshot {d.id.slice(0, 8)} ·{" "}
              {a ? "Reviewed by " + a.data.reviewer : "No approval recorded"}
            </p>
            <a
              className="button"
              href={"/api/reports/" + d.id + ".pdf"}
              target="_blank"
              rel="noreferrer"
            >
              Download {a ? "approved" : "draft"} PDF
            </a>
            {!a && user.role === "manager" && d.author !== user.id && (
              <button className="quiet" onClick={() => setSelected(d.id)}>
                Review document for issue
              </button>
            )}
            {!a && d.author === user.id && (
              <p>
                A separate manager must review and approve this document.
                Document review is not engineering certification.
              </p>
            )}
            {selected === d.id && !a && (
              <Editor
                title="Manager review"
                submit="Approve exact document snapshot"
                fields={[
                  {
                    name: "note",
                    label: "Review note and checked limitations",
                    type: "textarea",
                  },
                  {
                    name: "attest",
                    label: "Reviewed complete PDF and limitations",
                    options: [
                      "Yes - I have reviewed the complete PDF and limitations",
                    ],
                  },
                ]}
                onSave={async (x) => {
                  await onApprove({
                    documentId: d.id,
                    note: x.note,
                    attest: !!x.attest,
                  });
                  setSelected("");
                }}
              />
            )}
          </article>
        );
      })}
    </section>
  );
}
export function Workflow({
  route,
  pid,
  project,
  records,
  user,
  refresh,
}: {
  route: string;
  pid: string;
  project?: Project;
  records: RecordItem[];
  user: User;
  refresh: () => Promise<void>;
}) {
  const roofs = current(records, "roof"),
    defects = current(records, "defect"),
    photos = current(records, "photo"),
    materials = current(records, "material"),
    estimates = current(records, "estimate");
  const [roofId, setRoofId] = useState(""),
    [editRoof, setEditRoof] = useState<RecordItem>(),
    [editDefect, setEditDefect] = useState<RecordItem>(),
    [editMaterial, setEditMaterial] = useState<RecordItem>(),
    [editEstimate, setEditEstimate] = useState<RecordItem>(),
    [editPhoto, setEditPhoto] = useState<RecordItem>(),
    [query, setQuery] = useState(""),
    [gps, setGps] = useState<any>(null),
    [message, setMessage] = useState(""),
    [uploadError, setUploadError] = useState(""),
    [uploadBusy, setUploadBusy] = useState(false);
  useEffect(() => {
    if (!roofs.some((r) => r.data.entityId === roofId))
      setRoofId(roofs[0]?.data.entityId || "");
  }, [records]);
  const canEdit = ["manager", "supervisor", "engineer"].includes(user.role),
    options = roofs.map((r) => ({
      value: r.data.entityId,
      label: r.data.name,
    }));
  async function save(kind: string, data: any) {
    const r = await api("records", { pid, kind, data });
    await refresh();
    setMessage("Saved " + kind + " revision. Previous records are retained.");
    return r;
  }
  if (!project)
    return (
      <section>
        <p>Create or select a project to begin the survey-to-tender journey.</p>
        <a href="#projects">Open Project Register</a>
      </section>
    );
  return (
    <>
      <Journey records={records} />
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {!canEdit && (
        <p className="warning">
          Read-only account. Saved evidence, options and document snapshots are
          available for review.
        </p>
      )}
      {route === "survey" && (
        <>
          <p>
            Inspect each roof separately, record access limits and technical
            assumptions, then link defects and photographs. Observations are not
            structural certification.
          </p>
          <div className="roof-list">
            {roofs.map((r) => (
              <button
                key={r.id}
                className={r.data.entityId === roofId ? "" : "quiet"}
                onClick={() => setRoofId(r.data.entityId)}
              >
                {r.data.name} · {r.data.area} m² · rev {r.data.version}
              </button>
            ))}
          </div>
          {roofs
            .filter((r) => r.data.entityId === roofId)
            .map((r) => (
              <section key={r.id}>
                <h2>{r.data.name}</h2>
                <p>
                  {r.data.condition} · {r.data.covering} · {r.data.surveyor} ·{" "}
                  {r.data.surveyDate}
                </p>
                <p>{r.data.observations}</p>
                <p className="warning">{r.data.limitations}</p>
                {canEdit && (
                  <button className="quiet" onClick={() => setEditRoof(r)}>
                    Revise selected roof
                  </button>
                )}
              </section>
            ))}
          {canEdit && (
            <Editor
              key={editRoof?.id || "new-roof"}
              title={editRoof ? "Revise roof survey" : "Add a roof survey"}
              fields={roofFields}
              values={editRoof?.data}
              submit="Save roof survey"
              onCancel={editRoof ? () => setEditRoof(undefined) : undefined}
              onSave={async (d) => {
                const r = await save("roof", {
                  ...d,
                  previousId: editRoof?.id,
                });
                setRoofId(r.data.entityId);
                setEditRoof(undefined);
              }}
            />
          )}
          <section>
            <h2>Defect register</h2>
            <p>
              {defects.filter((d) => d.data.roofId === roofId).length} findings
              on the selected roof
            </p>
            {defects
              .filter((d) => d.data.roofId === roofId)
              .map((r) => (
                <article key={r.id}>
                  <h3>
                    {r.data.category} · {r.data.severity}
                  </h3>
                  <p>
                    {r.data.location} · {r.data.quantity} {r.data.unit}
                  </p>
                  <p>{r.data.description}</p>
                  <p>Action: {r.data.action}</p>
                  <p>Assumptions: {r.data.assumptions}</p>
                  {!photos.some((p) => p.data.defectId === r.data.entityId) && (
                    <p className="warning">
                      Evidence gap: no linked photograph
                    </p>
                  )}
                  {canEdit && (
                    <button className="quiet" onClick={() => setEditDefect(r)}>
                      Revise finding
                    </button>
                  )}
                </article>
              ))}
          </section>
          {canEdit && roofs.length > 0 && (
            <Editor
              key={editDefect?.id || "new-defect-" + roofId}
              title={editDefect ? "Revise defect" : "Record a defect"}
              submit="Save defect"
              values={editDefect?.data || { roofId }}
              fields={[
                { name: "roofId", label: "Defect roof", options },
                {
                  name: "category",
                  label: "Defect category",
                  options: [
                    "Corrosion / perforation",
                    "Failed previous repair",
                    "Flashing / ridge / lap joint",
                    "Rooflight / penetration",
                    "Fixings",
                    "Drainage / ponding",
                    "Membrane damage",
                    "Insulation / condensation",
                    "Water ingress",
                    "Other",
                  ],
                },
                {
                  name: "severity",
                  label: "Defect severity",
                  options: ["Low", "Medium", "High", "Critical"],
                },
                { name: "location", label: "Defect location / grid" },
                {
                  name: "quantity",
                  label: "Affected quantity",
                  type: "number",
                },
                { name: "unit", label: "Affected unit", options: [...units] },
                {
                  name: "description",
                  label: "Defect evidence description",
                  type: "textarea",
                },
                {
                  name: "action",
                  label: "Recommended action / investigation",
                  type: "textarea",
                },
                {
                  name: "assumptions",
                  label: "Defect technical assumptions / limits",
                  type: "textarea",
                },
              ]}
              onCancel={editDefect ? () => setEditDefect(undefined) : undefined}
              onSave={async (d) => {
                await save("defect", { ...d, previousId: editDefect?.id });
                setEditDefect(undefined);
              }}
            />
          )}
          {canEdit && roofs.length > 0 && (
            <section>
              <h2>Upload photographic evidence</h2>
              <p>
                Images are compressed in this browser and stored with the
                project. GPS is optional, browser-reported point evidence. No
                continuous location tracking occurs.
              </p>
              <button
                className="quiet"
                onClick={() => {
                  if (!navigator.geolocation)
                    return setUploadError("Location capture is unavailable");
                  navigator.geolocation.getCurrentPosition(
                    (p) => {
                      setGps({
                        lat: p.coords.latitude,
                        lng: p.coords.longitude,
                        accuracy: p.coords.accuracy,
                        observedAt: new Date(p.timestamp).toISOString(),
                      });
                      setUploadError("");
                    },
                    (e) => {
                      setGps(null);
                      setUploadError("GPS not captured: " + e.message);
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
                  );
                }}
              >
                Capture current GPS for these photos
              </button>
              {gps && (
                <p>
                  GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ±
                  {Math.round(gps.accuracy)}m{" "}
                  <button className="quiet" onClick={() => setGps(null)}>
                    Clear GPS
                  </button>
                </p>
              )}
              <form
                key={roofId}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    data = Object.fromEntries(new FormData(form)),
                    files = (
                      form.elements.namedItem("files") as HTMLInputElement
                    ).files!;
                  setUploadError("");
                  setUploadBusy(true);
                  try {
                    if (!files.length || files.length > 10)
                      throw Error("Choose 1 to 10 photographs");
                    for (const file of files) {
                      await save("photo", {
                        roofId: data.roofId,
                        defectId: data.defectId,
                        takenAt: data.takenAt,
                        caption: data.caption + " · " + file.name,
                        image: await photoData(file),
                        annotations: [],
                        gps,
                      });
                    }
                    form.reset();
                    setGps(null);
                  } catch (e) {
                    setUploadError(
                      (e as Error).message +
                        " Any successfully uploaded photos are listed below; only retry missing files.",
                    );
                  } finally {
                    setUploadBusy(false);
                  }
                }}
              >
                <div className="fields">
                  <Input
                    field={{ name: "roofId", label: "Photo roof", options }}
                    values={{ roofId }}
                  />
                  <Input
                    field={{
                      name: "defectId",
                      label: "Link photograph to defect",
                      optional: true,
                      options: defects
                        .filter((d) => d.data.roofId === roofId)
                        .map((d) => ({
                          value: d.data.entityId,
                          label: d.data.location + " / " + d.data.category,
                        })),
                    }}
                    values={{}}
                  />
                  <Input
                    field={{
                      name: "takenAt",
                      label: "Photograph date (user entered)",
                      type: "date",
                    }}
                    values={{ takenAt: today() }}
                  />
                  <Input
                    field={{ name: "caption", label: "Photograph caption" }}
                    values={{}}
                  />
                  <label>
                    Photo files (up to 10)
                    <input
                      name="files"
                      type="file"
                      accept="image/*"
                      multiple
                      required
                    />
                  </label>
                </div>
                {uploadError && (
                  <p role="alert" className="error">
                    {uploadError}
                  </p>
                )}
                <button disabled={uploadBusy}>
                  {uploadBusy ? "Uploading…" : "Save photo evidence"}
                </button>
              </form>
            </section>
          )}
          <section>
            <h2>Evidence gallery</h2>
            {!photos.some((p) => p.data.roofId === roofId) && (
              <p className="warning">
                No photographic evidence for the selected roof.
              </p>
            )}
            <div className="photo-grid">
              {photos
                .filter((p) => p.data.roofId === roofId)
                .map((p) => (
                  <article key={p.id}>
                    <div className="photo-thumb">
                      <img
                        src={"/api/evidence/" + p.data.assetId}
                        alt={p.data.caption}
                      />
                    </div>
                    <h3>{p.data.caption}</h3>
                    <p>
                      {p.data.takenAt} ·{" "}
                      {p.data.gps
                        ? "GPS captured (browser reported)"
                        : "GPS not captured"}
                    </p>
                    <p>
                      {p.data.annotations.length} marked areas · revision{" "}
                      {p.data.version}
                    </p>
                    {canEdit && (
                      <button className="quiet" onClick={() => setEditPhoto(p)}>
                        Annotate / revise photo
                      </button>
                    )}
                  </article>
                ))}
            </div>
          </section>
          {editPhoto && (
            <Annotator
              key={editPhoto.id}
              photo={editPhoto}
              onSave={(d) => save("photo", d)}
              onCancel={() => setEditPhoto(undefined)}
            />
          )}
          <Documents
            records={records}
            user={user}
            type="survey"
            estimates={estimates}
            onCreate={(d) => save("document", d)}
            onApprove={(d) => save("approval", d)}
          />
        </>
      )}
      {route === "materials" && (
        <>
          <p>
            Record manufacturer documents, revision dates and technical
            limitations. A source entry is not a product approval or a
            guarantee. Rates remain optional and require provenance when
            entered.
          </p>
          <label>
            Search materials and source references
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {materials
            .filter((m) =>
              JSON.stringify(m.data)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((m) => (
              <section key={m.id}>
                <h2>{m.data.name}</h2>
                <p>
                  {m.data.manufacturer} · {m.data.category} · {m.data.unit} ·
                  revision {m.data.version}
                </p>
                <p>{m.data.properties}</p>
                <p>
                  Source: {m.data.sourceReference} · {m.data.sourceRevision} ·
                  checked {m.data.sourceDate}
                </p>
                {m.data.sourceUrl && (
                  <a href={m.data.sourceUrl} target="_blank" rel="noreferrer">
                    Open source document
                  </a>
                )}
                <p>{m.data.sourceStatus}</p>
                {m.data.validUntil && m.data.validUntil < today() && (
                  <p className="warning">
                    Source review overdue - review before quotation approval
                  </p>
                )}
                <p>
                  Budget rate:{" "}
                  {m.data.rate === ""
                    ? "Unpriced"
                    : "£" + m.data.rate + " / " + m.data.unit}{" "}
                  · {m.data.rateSource || "No rate source recorded"}
                </p>
                {canEdit && (
                  <button className="quiet" onClick={() => setEditMaterial(m)}>
                    Revise material
                  </button>
                )}
              </section>
            ))}
          {canEdit && (
            <Editor
              key={editMaterial?.id || "new-material"}
              title={
                editMaterial
                  ? "Revise material source"
                  : "Add material and specification source"
              }
              fields={materialFields}
              values={editMaterial?.data}
              submit="Save material source"
              onCancel={
                editMaterial ? () => setEditMaterial(undefined) : undefined
              }
              onSave={async (d) => {
                await save("material", { ...d, previousId: editMaterial?.id });
                setEditMaterial(undefined);
              }}
            />
          )}
        </>
      )}
      {route === "estimating" && (
        <>
          <p>
            Build independent options with measured or roof-linked takeoff,
            sourced rates, and separate material, labour, plant, scaffold and
            preliminaries costs. Contingency applies to direct costs; sales
            margin is applied after contingency; VAT uses the rate you enter.
          </p>
          <section className="commercial-comparison">
            <h2>Commercial option comparison</h2>
            <p>Compare current, fully priced tender options. Superseded source measurements or unpriced lines are excluded from lowest-price indicators. This is not an approval or tender award.</p>
            {!estimates.length ? (
              <p>No tender options recorded.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Option</th>
                      <th>Direct cost</th>
                      <th>Profit</th>
                      <th>Net quote</th>
                      <th>Inc. VAT</th>
                      <th>Comparison status</th>
                      <th>Revision / action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareTenderOptions(estimates, roofs, materials).map((option) => (
                      <tr key={option.id}>
                        <th>{option.title}</th>
                        <td>{pounds(option.directPence)}</td>
                        <td>{pounds(option.profitPence)}</td>
                        <td>{pounds(option.netPence)}</td>
                        <td>{pounds(option.grossPence)}</td>
                        <td>
                          {option.lowestCurrentNet && <span className="comparison-label">Lowest current net quote</span>}
                          {!option.complete && <p className="warning">Unpriced lines — not comparable</p>}
                          {option.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}
                          {option.comparable && !option.lowestCurrentNet && <small>Current and fully priced</small>}
                        </td>
                        <td>
                          rev {option.version}
                          {canEdit && (
                            <button className="quiet" onClick={() => setEditEstimate(estimates.find(e => e.id === option.id))}>
                              Revise option
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {canEdit && (
            <EstimateEditor
              key={editEstimate?.id || "new-estimate"}
              record={editEstimate}
              roofs={roofs}
              materials={materials}
              onCancel={() => setEditEstimate(undefined)}
              onSave={async (d) => {
                await save("estimate", d);
                setEditEstimate(undefined);
              }}
            />
          )}
          <Documents
            records={records}
            user={user}
            type="quotation"
            estimates={estimates}
            onCreate={(d) => save("document", d)}
            onApprove={(d) => save("approval", d)}
          />
        </>
      )}
    </>
  );
}
