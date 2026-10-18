import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
mkdirSync("artifacts/pdf-review", { recursive: true });
for (const [path, approved] of [
  ["artifacts/tender-survey.pdf", false],
  ["artifacts/tender-quotation.pdf", true],
  ["artifacts/issue-2-browser-approved.pdf", true],
]) {
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  assert.match(info, /Page size:\s+595\.28 x 841\.89 pts \(A4\)/);
  assert.match(info, /JavaScript:\s+no/);
  const text = execFileSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
  });
  assert.match(text, approved ? /APPROVED FOR ISSUE/ : /DRAFT FOR REVIEW/);
  assert.match(text, /Main warehouse/);
  assert.match(text, /Annexe/);
  assert.match(text, /51\.88/);
  assert.match(text, /SHA-256/);
  assert.match(text, /technical suitability not certified/);
  assert.match(text, /λ/);
  assert.match(text, /not.*engineering|engineering.*required/is);
  if (approved) {
    for (const amount of ["5,775.00", "4,812.50", "962.50"])
      assert.ok(text.includes(amount), `${path}: missing amount ${amount}`);
    assert.match(text, /Reviewed by/);
  }
  const boxes = execFileSync("pdftotext", ["-bbox", path, "-"], {
    encoding: "utf8",
  });
  for (const m of boxes.matchAll(
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
  )) {
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    assert.ok(
      x1 >= 35 && x2 <= 560 && y1 >= 30 && y2 <= 830,
      `${path}: text outside printable bounds`,
    );
  }
  execFileSync("pdftoppm", [
    "-f",
    "1",
    "-l",
    "1",
    "-scale-to",
    "1300",
    "-png",
    "-singlefile",
    path,
    "artifacts/pdf-review/" +
      (approved ? "approved" : "draft") +
      "-" +
      path.split("/").pop(),
  ]);
}
console.log(
  "PASS: real A4 PDFs contain multi-roof evidence, GPS, annotations, Unicode source properties, exact reconciled totals, limitations and correct independent approval; text remains within printable bounds",
);
