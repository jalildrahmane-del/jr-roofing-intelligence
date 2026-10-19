import { Store } from "../server/store.ts";
import { saveRecord } from "../server/index.ts";
import type { User } from "../src/model.ts";
export type PreviewAccount = {
  name: string;
  password: string;
  role: "manager" | "engineer" | "supervisor" | "viewer";
};
export function seedPreview(
  path: string,
  accounts: PreviewAccount[],
  image: Buffer,
) {
  const store = new Store(path),
    day = (n = 0) =>
      new Date(Date.now() + n * 86400000).toISOString().slice(0, 10),
    users: Record<string, User> = {};
  try {
    for (const a of accounts) {
      const id = store.addUser(
        a.name,
        a.password,
        a.role,
        "Fictional Owner Review",
      );
      users[a.name] = {
        id,
        name: a.name,
        role: a.role,
        company: "Fictional Owner Review",
      };
    }
    const owner = users.owner;
    if (!owner || owner.role !== "manager")
      throw Error("Owner review account required");
    const project = store.project(owner, {
        name: "[FICTIONAL] Riverside Warehouse",
        client: "Fictional client - software review only",
        address: "Fictional site - no real property address",
        area: 194,
        type: "Commercial",
        roof: "Mixed flat and metal",
      }),
      save = (kind: string, data: any) =>
        store.transaction(() =>
          saveRecord(store, owner, project.id, kind, data),
        );
    const roofData = {
      pitch: 5,
      covering: "Standing seam metal",
      structure: "Fictional steel purlins; capacity unverified",
      installed: "Unknown",
      surveyDate: day(),
      surveyor: "Fictional surveyor",
      access: "Visual inspection only; no live roof access authorised",
      condition: "Poor",
      leaks: "Unknown",
      insulation: "Thickness not verified",
      drainage: "Fictional outlet investigation required",
      observations:
        "Fictional corrosion and failed repairs for exploring the survey workflow.",
      limitations:
        "Fictional data only. No real inspection, structural acceptance or product suitability established.",
    };
    const roof = save("roof", {
      ...roofData,
      name: "Main warehouse roof",
      area: 100,
    });
    save("roof", { ...roofData, name: "Annexe roof", area: 94 });
    const defect = save("defect", {
      roofId: roof.data.entityId,
      category: "Corrosion / perforation",
      severity: "High",
      location: "Fictional ridge grid A1",
      quantity: 5,
      unit: "m",
      description:
        "Fictional corrosion finding linked to a generated illustration",
      action: "Investigate fragility and obtain qualified design review",
      assumptions:
        "Fictional observation; no actual site access or engineering permission",
    });
    save("photo", {
      roofId: roof.data.entityId,
      defectId: defect.data.entityId,
      takenAt: day(),
      caption:
        "FICTIONAL generated roof illustration - not a real survey photograph",
      image: "data:image/png;base64," + image.toString("base64"),
      annotations: [
        { x: 0.32, y: 0.35, w: 0.2, h: 0.25, label: "Fictional defect area" },
      ],
    });
    const material = save("material", {
      name: "Fictional roof covering panel",
      manufacturer: "Fictional manufacturer",
      category: "Roof covering",
      unit: "m²",
      sourceUrl: "",
      sourceReference: "FICTIONAL-DATASHEET-001",
      sourceRevision: "A",
      sourceDate: day(),
      validUntil: day(90),
      properties:
        "Fictional properties only; verify actual product data before real use.",
      rate: "20.00",
      rateSource: "Fictional rate for software arithmetic",
      rateDate: day(),
    });
    const lines = [
      {
        description: "Fictional roof covering",
        category: "material",
        unit: "m²",
        basis: "roof-area",
        roofId: roof.data.entityId,
        materialId: material.data.entityId,
        quantity: 100,
        waste: 10,
        rate: "20.00",
        rateSource: "Fictional quotation",
        rateDate: day(),
      },
      ...[
        ["labour", "Labour", 16, 25, "hour"],
        ["plant", "Access plant", 2, 150, "day"],
        ["scaffold", "Scaffold", 1, 500, "item"],
        ["prelims", "Preliminaries", 1, 100, "item"],
      ].map(([category, description, quantity, rate, unit]) => ({
        category,
        description,
        quantity,
        rate,
        unit,
        basis: "measured",
        roofId: "",
        materialId: "",
        waste: 0,
        rateSource: "Fictional quotation",
        rateDate: day(),
      })),
    ];
    const estimate = save("estimate", {
      title: "Option A - fictional overcladding",
      scope:
        "Fictional roof covering, labour, access, scaffold and preliminaries",
      exclusions:
        "Structural strengthening and all real engineering approvals excluded",
      assumptions:
        "Fictional rates only. Re-measure and obtain actual sources for real work.",
      paymentTerms: "Fictional terms; not a commercial offer",
      validUntil: day(90),
      lines,
      contingency: 10,
      margin: 20,
      vat: 20,
    });
    save("estimate", {
      ...estimate.data,
      title: "Option B - fictional repair comparison",
      lines: [
        {
          ...lines[1],
          category: "labour",
          description: "Fictional alternative repair allowance",
          quantity: 40,
          rate: 25,
        },
      ],
      contingency: 0,
      margin: 0,
      vat: 20,
    });
    save("document", {
      type: "survey",
      title: "FICTIONAL draft multi-roof survey",
    });
    save("document", {
      type: "quotation",
      title: "FICTIONAL draft quotation - Option A",
      estimateId: estimate.data.entityId,
    });
    const load = save("load", {
        thickness: 18,
        density: 650,
        area: 94,
        other: 0.25,
      }),
      drawing = save("drawing", {
        number: "FICTIONAL-D-001",
        revision: "A",
        title: "Fictional roof and loading layout",
        source: "FICTIONAL-DRAWING-A; no technical authority",
        purpose: "design",
      }),
      loadcase = save("loadcase", {
        title: "18mm OSB - pending qualified review",
        loadId: load.id,
        drawingId: drawing.id,
        assumptions:
          "Existing sheets, services, OSB and temporary load sequence unverified",
        source: "FICTIONAL input record",
        calculationReference:
          "FICTIONAL-CALC-REFERENCE; no signed calculation supplied",
      });
    save("query", {
      title: "18mm OSB construction-stage review",
      question:
        "Confirm actual roof capacity, services allowance, board weight and safe installation sequence.",
      loadcaseId: loadcase.id,
      drawingId: drawing.id,
    });
    save("rfi", {
      title: "Fictional loading clarification",
      question:
        "Confirm temporary storage and support sequence against the actual design.",
      drawingId: drawing.id,
      due: day(14),
    });
    // No engineer appointment, acceptance, inspection or work release is fabricated.
    save("workplan", {
      title: "Fictional roof refurbishment scope",
      hotWork: "yes",
      scaffold: "yes",
      rationale: "Fictional permit scope for testing mandatory control gates",
    });
    for (const category of [
      "RAMS",
      "CPP",
      "working-at-height",
      "scaffold",
      "hot-work",
    ])
      save("control", {
        title: "FICTIONAL " + category,
        category,
        source: "FICTIONAL-" + category + "-DRAFT-A",
        method:
          "Fictional draft method and hazard controls; not approved for actual use.",
        rescue:
          "Fictional arrangements require competent site-specific review.",
        competence: "No real competence evidence - fictional sample only",
        validFrom: day(-1) + "T00:00",
        validUntil: day(90) + "T23:59",
      });
    save("programme", {
      title: "Fictional roofing installation",
      baselineStart: day(),
      baselineEnd: day(7),
      plannedStart: day(),
      plannedEnd: day(7),
      progress: "25",
      actualStart: day(),
      actualEnd: "",
    });
    save("diary", {
      title: "Fictional site diary",
      date: day(),
      weather: "Fictional dry conditions - no live weather service",
      labour: "Fictional team and access plant",
      work: "Fictional survey and planning activities",
      events: "Fictional loading query remains pending",
      evidence: "FICTIONAL-DIARY-001",
    });
    for (const stage of ["prestart", "installation", "final"])
      save("holdpoint", {
        title: "Fictional " + stage + " inspection",
        stage,
        criteria:
          "Fictional specification criteria - replace with real project evidence for real work",
        method: "Recorded visual and measured verification",
        source: "FICTIONAL-ITP-A",
      });
    save("snag", {
      title: "Fictional flashing snag",
      location: "Fictional ridge",
      description:
        "Fictional gap requiring repair and independent reinspection",
      owner: "Fictional installer",
      due: day(14),
      remedy: "",
      evidence: "",
    });
    for (const category of [
      "O&M",
      "as-built",
      "warranty",
      "test-certificate",
      "maintenance",
    ])
      save("handoverItem", {
        title: "FICTIONAL " + category + " draft reference",
        category,
        revision: "A",
        source: "FICTIONAL-" + category + "-A; no actual signed document",
        description:
          "Fictional handover register entry for software review. Not a certificate or warranty.",
      });
    const second = store.project(owner, {
      name: "[FICTIONAL] Meadow Offices",
      client: "Fictional office client",
      address: "Fictional review location",
      area: 80,
      type: "Commercial",
      roof: "Flat",
    });
    store.transaction(() =>
      saveRecord(store, owner, second.id, "roof", {
        ...roofData,
        name: "Office roof",
        area: 80,
        pitch: 2,
        covering: "Single-ply membrane",
        condition: "Fair",
        observations:
          "Fictional office roof needing a closer drainage inspection.",
      }),
    );
    store.transaction(() =>
      store.append(owner, project.id, "ownerPreviewDataset", {
        source: "Merged application with fictional owner-review data",
        version: 1,
        noSafetyApproval: true,
      }),
    );
    return { users, projectId: project.id };
  } finally {
    store.close();
  }
}
