import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/tender.ts";
import { tenderXlsx } from "../src/tender-xlsx.ts";
const decode = new TextDecoder();
test("XLSX export has valid Office Open XML parts and exact pence totals", () => {
 const pricing=calculate([{description:"=HYPERLINK(\"https://bad.example\")",category:"material",unit:"m²",basis:"measured",quantity:"2",waste:"0",rate:"12.50",rateSource:"Synthetic quote",rateDate:"2026-11-01"}],10,20,20,[],[]);
 const bytes=tenderXlsx(pricing,"Test & project\u0000","Option <A>");
 assert.equal(decode.decode(bytes.slice(0,4)),"PK\u0003\u0004");
 const raw=decode.decode(bytes);
 for(const name of ["[Content_Types].xml","xl/workbook.xml","xl/worksheets/sheet1.xml"])assert.ok(raw.includes(name));
 assert.ok(raw.includes("Test &amp; project"));
 assert.ok(raw.includes("Option &lt;A&gt;"));
 assert.ok(raw.includes("=HYPERLINK("));
 assert.ok(raw.includes('t="inlineStr"'));
 assert.ok(raw.includes(String(pricing.grossPence!/100)));
 assert.ok(!raw.includes("<f>"));
 assert.ok(!raw.includes("project\u0000"));
});
