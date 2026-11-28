import {createHash} from 'node:crypto';
import { createRequire } from "node:module";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  folder = mkdtempSync(join(tmpdir(), "jr-tender-browser-")),
  store = new Store(join(folder, "db.sqlite"));
store.addUser("survey-author", "synthetic-test-password", "manager");
store.addUser("survey-reviewer", "synthetic-test-password", "manager");
const server = createApp(store, resolve("dist"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.JR_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-gpu", "--no-zygote", "--single-process"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["geolocation"],
      geolocation: { latitude: 51.88, longitude: -0.37, accuracy: 8 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync("artifacts", { recursive: true });
  const date = new Date().toISOString().slice(0, 10),
    future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const login = async (name) => {
    await page
      .getByRole("textbox", { name: "Username", exact: true })
      .fill(name);
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic-test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .locator("header")
      .getByText(name + " · manager")
      .waitFor();
  };
  const section = (name) =>
    page.getByRole("heading", { name, exact: true }).locator("..");
  async function fill(scope, values) {
    for (const [label, value] of Object.entries(values))
      await scope.getByLabel(label, { exact: true }).fill(String(value));
  }
  async function choose(scope, label, value) {
    await scope
      .getByLabel(label, { exact: true })
      .selectOption({ label: value });
  }
  async function saved(kind) {
    await page
      .getByRole("status")
      .getByText("Saved " + kind + " revision.", { exact: false })
      .waitFor();
  }
  async function roof(name, area) {
    const form = section("Add a roof survey");
    await fill(form, {
      "Roof name / asset": name,
      "Measured roof area (m²)": area,
      "Roof pitch (degrees)": 5,
      "Primary structure / unknown": "Steel purlins - not verified",
      Surveyor: "Synthetic browser surveyor",
      "Access method and restrictions":
        "Visual observations from safe access platform",
      "Drainage observations": "Outlet needs closer inspection",
      "Survey observations":
        "Synthetic corrosion and failed repairs for testing only",
      "Access limitations and technical assumptions":
        "Visual inspection only. No core samples or structural capacity verified.",
    });
    await choose(form, "Roof covering", "Standing seam metal");
    await choose(form, "Condition", "Poor");
    await choose(form, "Reported leaks", "Unknown");
    await form
      .getByRole("button", { name: "Save roof survey", exact: true })
      .click();
    await saved("roof");
    await page
      .getByRole("button", { name: new RegExp(name + " · " + area) })
      .waitFor();
  }
  await page.goto(base);
  await login("survey-author");
  await page
    .getByRole("link", { name: "Project Register", exact: true })
    .click();
  await fill(page, {
    "Project name": "Synthetic survey-to-tender UI test",
    Client: "Test client",
    "Site address": "Synthetic facility - not a real inspection",
    "Roof area (m²)": 194,
    Sector: "Commercial",
    "Roof type": "Mixed",
  });
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .locator("li")
    .getByText("Synthetic survey-to-tender UI test")
    .waitFor();
  await page
    .getByRole("link", { name: "Roof Survey Intelligence", exact: true })
    .click();
  await roof("Main warehouse", 100);
  await roof("Annexe", 94);
  await page.getByRole("button", { name: /Main warehouse · 100/ }).click();
  // Exercise the real download and SVG screen transform at desktop and mobile sizes.
  const sketch = page.locator(".roof-plan-drawing");
  await sketch.getByText("Preview georeferenced roof outline", {exact:true}).click();
  const geoInput=sketch.getByLabel("Roof GeoJSON file");
  const geoPreview=sketch.locator("details").filter({has:page.getByText("Preview georeferenced roof outline", {exact:true})});
  const validGeo=JSON.stringify({type:"Polygon",coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.8]]]});
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    const quadGeo=JSON.stringify({type:"Polygon",coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.801],[-0.4,51.8]]]});
    await geoInput.setInputFiles({name:"quad.geojson",mimeType:"application/json",buffer:Buffer.from(quadGeo)});
    await geoPreview.getByRole("status").waitFor();
    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();
    await geoPreview.getByLabel("Geographic vertex",{exact:true}).selectOption("1");
    await geoPreview.getByRole("button",{name:"Remove geographic vertex",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),3);
    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();
    assert.equal(await geoPreview.getByRole("button",{name:"Remove geographic vertex",exact:true}).isDisabled(),true);
    await geoPreview.getByRole("button",{name:"Undo geographic edit",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),4);
    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();
    await geoPreview.getByRole("button",{name:"Apply geographic vertex",exact:true}).click();
    assert.equal(await geoPreview.getByRole("button",{name:"Redo geographic edit",exact:true}).isDisabled(),false);
    await geoPreview.getByRole("button",{name:"Redo geographic edit",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),3);
    assert.equal(await geoPreview.getByRole("button",{name:"Redo geographic edit",exact:true}).isDisabled(),true);
    await geoPreview.getByRole("button",{name:"Undo geographic edit",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),4);

    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();
    await geoPreview.getByRole("button",{name:"Insert geographic vertex after selected",exact:true}).click();
    await geoPreview.getByRole("alert").waitFor();
    assert.equal(await geoPreview.locator("li").count(),4);
    await geoPreview.getByLabel("Vertex longitude",{exact:true}).fill("-0.3995");
    await geoPreview.getByLabel("Vertex latitude",{exact:true}).fill("51.7999");
    await geoPreview.getByRole("button",{name:"Insert geographic vertex after selected",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),5);
    assert.equal(await geoPreview.getByRole("button",{name:"Redo geographic edit",exact:true}).isDisabled(),true);
    assert.equal(await geoPreview.locator("li").nth(1).textContent(),"-0.3995, 51.7999");
    const insertedDownloadPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download validated GeoJSON outline"}).click();
    const insertedDownload=await insertedDownloadPending;
    const insertedGeometry=JSON.parse(readFileSync(await insertedDownload.path(),"utf8")).geometry;
    assert.equal(insertedGeometry.coordinates[0].length,6);
    assert.deepEqual(insertedGeometry.coordinates[0][1],[-0.3995,51.7999]);

    await geoPreview.getByRole("button",{name:"Undo geographic edit",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),4);

    await geoInput.setInputFiles({name:"inserted.geojson",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(insertedGeometry))});
    await geoPreview.getByText("5 geographic boundary points loaded. Longitude, latitude in degrees; not metres.",{exact:true}).waitFor();
    await geoPreview.getByRole("button",{name:"Save geographic roof revision",exact:true}).click();
    await saved("roof");
    await page.reload();
    await sketch.getByText("Preview georeferenced roof outline",{exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),5);
    assert.equal(await geoPreview.locator("li").nth(1).textContent(),"-0.3995, 51.7999");
    await geoInput.setInputFiles({name:"roof.geojson",mimeType:"application/json",buffer:Buffer.from(validGeo)});
    await geoPreview.getByText("3 geographic boundary points loaded. Longitude, latitude in degrees; not metres.",{exact:true}).waitFor();
    assert.equal(await geoPreview.locator("li").count(),3);
    const diagram=geoPreview.getByRole("group",{name:"Imported roof outline in longitude and latitude"});
    await geoPreview.getByText("Local georeferenced reference image",{exact:true}).click();
    await geoPreview.getByLabel("Local reference image",{exact:true}).setInputFiles("tests/fixtures/roof.png");
    for(const [side,value] of Object.entries({west:"-0.401",south:"51.799",east:"-0.398",north:"51.802"}))await geoPreview.getByLabel(`Image ${side} bound`,{exact:true}).fill(value);
    await geoPreview.getByLabel("Image source reference",{exact:true}).fill("Synthetic test source");
    await geoPreview.getByLabel("Image capture date",{exact:true}).fill("2026-01-15");
    await geoPreview.getByLabel("Image rights and alignment notes",{exact:true}).fill("Synthetic fixture only; alignment unverified");
    await geoPreview.getByRole("button",{name:"Apply reference image bounds",exact:true}).click();
    assert.equal(await diagram.locator("image").count(),1);
    assert.ok((await diagram.locator("image").getAttribute("href")).startsWith("data:image/png"));
    assert.ok(Number(await diagram.locator("image").getAttribute("width"))>0);
    await geoPreview.getByLabel("Image west bound",{exact:true}).fill("0");
    await geoPreview.getByRole("button",{name:"Apply reference image bounds",exact:true}).click();
    await geoPreview.getByRole("alert").waitFor();
    assert.equal(await diagram.locator("image").count(),1);
    await geoPreview.getByLabel("Image source reference",{exact:true}).fill("Unapplied source change");
    const imageRecordPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download applied image record",exact:true}).click();
    const imageRecordDownload=await imageRecordPending;
    assert.equal(imageRecordDownload.suggestedFilename(),"preliminary-reference-image.json");
    const imageRecordText=readFileSync(await imageRecordDownload.path(),"utf8");
    const imageRecord=JSON.parse(imageRecordText);
    assert.equal(imageRecord.status,"preliminary-unverified");
    assert.equal(imageRecord.image.sha256,createHash("sha256").update(readFileSync("tests/fixtures/roof.png")).digest("hex"));
    assert.equal(imageRecord.image.bytes,readFileSync("tests/fixtures/roof.png").length);
    assert.ok(imageRecord.image.width>0&&imageRecord.image.height>0);
    assert.equal(imageRecord.bounds.west,-0.401);
    assert.equal(imageRecord.sourceReference,"Synthetic test source");
    assert.equal(imageRecord.imageDate,"2026-01-15");
    assert.ok(!imageRecordText.includes("data:image"));
    await geoPreview.getByRole("button",{name:"Remove reference image",exact:true}).click();
    assert.equal(await diagram.locator("image").count(),0);
    assert.equal(await geoPreview.getByRole("button",{name:"Download applied image record",exact:true}).isDisabled(),true);
    await geoPreview.getByLabel("Local reference image",{exact:true}).setInputFiles("tests/fixtures/roof.png");
    await geoPreview.getByLabel("Image west bound",{exact:true}).fill("-0.401");
    await geoPreview.getByRole("button",{name:"Apply reference image bounds",exact:true}).click();
    assert.equal(await diagram.locator("image").count(),1);


    await geoPreview.getByRole("button",{name:"Select geographic vertex 3",exact:true}).click();
    assert.equal(await geoPreview.getByLabel("Geographic vertex",{exact:true}).inputValue(),"2");
    assert.equal(await geoPreview.getByLabel("Vertex latitude",{exact:true}).inputValue(),"51.801");
    assert.equal(await geoPreview.getByRole("button",{name:"Select geographic vertex 3",exact:true}).getAttribute("aria-pressed"),"true");
    await geoPreview.getByLabel("Vertex latitude",{exact:true}).fill("51.8012");
    await geoPreview.getByRole("button",{name:"Zoom in outline",exact:true}).click();
    await geoPreview.getByRole("button",{name:"Pan outline east",exact:true}).click();
    await geoPreview.getByRole("button",{name:"Fit outline",exact:true}).click();
    assert.equal(await diagram.getAttribute("viewBox"),"0 0 300 300");
    assert.equal(await geoPreview.getByLabel("Geographic vertex",{exact:true}).inputValue(),"2");
    assert.equal(await geoPreview.getByLabel("Vertex latitude",{exact:true}).inputValue(),"51.8012");
    assert.equal(await geoPreview.locator("li").nth(2).textContent(),"-0.399, 51.801");
    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();
    await geoPreview.getByRole("button",{name:"Select geographic vertex 3",exact:true}).focus();
    await page.keyboard.press("Space");
    assert.equal(await geoPreview.getByLabel("Vertex latitude",{exact:true}).isVisible(),true);
    assert.equal(await geoPreview.getByLabel("Vertex latitude",{exact:true}).inputValue(),"51.8012");
    await geoPreview.getByRole("button",{name:"Select geographic vertex 1",exact:true}).focus();
    await page.keyboard.press("Enter");
    assert.equal(await geoPreview.getByLabel("Geographic vertex",{exact:true}).inputValue(),"0");
    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();

    assert.equal(await diagram.getAttribute("viewBox"),"0 0 300 300");
    await geoPreview.getByRole("button",{name:"Zoom in outline",exact:true}).click();
    assert.equal(await diagram.getAttribute("viewBox"),"75 75 150 150");
    await geoPreview.getByRole("button",{name:"Pan outline east",exact:true}).click();
    assert.equal(await diagram.getAttribute("viewBox"),"90 75 150 150");
    await geoPreview.getByRole("button",{name:"Fit outline",exact:true}).click();
    assert.equal(await diagram.getAttribute("viewBox"),"0 0 300 300");
    await geoPreview.getByText("Edit geographic vertex",{exact:true}).click();
    await geoPreview.getByLabel("Vertex latitude",{exact:true}).fill("91");
    await geoPreview.getByRole("button",{name:"Apply geographic vertex",exact:true}).click();
    await geoPreview.getByRole("alert").waitFor();
    await geoPreview.getByLabel("Vertex latitude",{exact:true}).fill("51.8");
    await geoPreview.getByLabel("Vertex longitude",{exact:true}).fill("-0.4001");
    await geoPreview.getByRole("button",{name:"Apply geographic vertex",exact:true}).click();
    await geoPreview.getByText("Unsaved geographic changes — save a roof revision to retain them.",{exact:true}).waitFor();
    await geoInput.setInputFiles({name:"invalid-replacement.geojson",mimeType:"application/json",buffer:Buffer.from('{"type":"Point"}')});
    await geoPreview.getByRole("alert").waitFor();
    await geoInput.setInputFiles([]);
    assert.equal(await geoPreview.locator("li").count(),3);
    assert.deepEqual(await geoPreview.locator("svg text").allTextContents(),["1","2","3"]);
    await geoPreview.getByRole("button",{name:"Zoom in outline",exact:true}).click();
    assert.equal(await geoPreview.locator("svg polygon").getAttribute("stroke-width"),"1");
    assert.equal(await geoPreview.locator("svg circle").first().getAttribute("r"),"1.5");
    assert.equal(await geoPreview.locator("svg text").first().getAttribute("font-size"),"6");
    await geoPreview.getByRole("button",{name:"Fit outline",exact:true}).click();
    assert.equal(await geoPreview.locator("svg polygon").getAttribute("stroke-width"),"2");
    const csvPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download geographic coordinates CSV",exact:true}).click();
    const csvDownload=await csvPending;
    assert.equal(csvDownload.suggestedFilename(),"preliminary-geographic-vertices.csv");
    const csvRows=readFileSync(await csvDownload.path(),"utf8").trim().split("\r\n");
    assert.equal(csvRows.length,4);
    assert.equal(csvRows[1],"1,-0.4001,51.8,EPSG:4326,preliminary-unverified");
    await geoPreview.getByText("Paste GeoJSON boundary",{exact:true}).click();
    await geoPreview.getByLabel("GeoJSON boundary text",{exact:true}).fill('{"type":"Point"}');
    await geoPreview.getByRole("button",{name:"Import pasted geographic outline",exact:true}).click();
    await geoPreview.getByRole("alert").waitFor();
    assert.equal(await geoPreview.locator("li").count(),3);
    const projectedVertices=(await geoPreview.locator("svg polygon").getAttribute("points")).split(' ').map(p=>p.split(',').map(Number));
    const projectedRatio=(projectedVertices[1][0]-projectedVertices[0][0])/(projectedVertices[1][1]-projectedVertices[2][1]);
    assert.ok(Math.abs(projectedRatio-1.1*Math.cos(51.8005*Math.PI/180))<1e-7);
    assert.ok((await geoPreview.textContent()).includes("Local spherical equirectangular preview"));
    const areaPanel=geoPreview.getByRole("region",{name:"Preliminary geographic footprint area"});
    const footprint=Number(await areaPanel.locator("strong").textContent());
    const expectedFootprint=6371008.8**2*(0.0011*Math.PI/180)*(Math.sin(51.801*Math.PI/180)-Math.sin(51.8*Math.PI/180))/2;
    assert.ok(Math.abs(footprint-expectedFootprint)<0.01);
    assert.ok((await areaPanel.textContent()).includes("not adopted into quantities"));
    const measurementPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download geographic measurement record",exact:true}).click();
    const measurementDownload=await measurementPending;
    assert.equal(measurementDownload.suggestedFilename(),"preliminary-geographic-measurements.json");
    const measurementRecord=JSON.parse(readFileSync(await measurementDownload.path(),"utf8"));
    assert.equal(measurementRecord.status,"preliminary-unverified");
    assert.equal(measurementRecord.format,"jr-geographic-measurements");
    assert.ok(Math.abs(measurementRecord.footprintAreaSquareMetres-expectedFootprint)<0.0001);
    assert.deepEqual(measurementRecord.geometry.coordinates[0][0],[-0.4001,51.8]);
    assert.equal(measurementRecord.perimeterMetres,measurementRecord.edges.reduce((sum,e)=>sum+e.metres,0));
    const distancePanel=geoPreview.getByRole("region",{name:"Preliminary geographic distances"});
    assert.equal(await distancePanel.locator("tbody tr").count(),3);
    assert.ok((await distancePanel.textContent()).includes("Approximate perimeter:"));
    const distanceDownloadPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download geographic distance record",exact:true}).click();
    const distanceDownload=await distanceDownloadPending;
    assert.equal(distanceDownload.suggestedFilename(),"preliminary-geographic-distances.json");
    const distanceRecord=JSON.parse(readFileSync(await distanceDownload.path(),"utf8"));
    assert.equal(distanceRecord.status,"preliminary-unverified");
    assert.deepEqual(distanceRecord.geometry.coordinates[0][0],[-0.4001,51.8]);
    assert.equal(distanceRecord.edges.length,3);
    assert.equal(distanceRecord.perimeterMetres,distanceRecord.edges.reduce((sum,e)=>sum+e.metres,0));
    const geoDownloadPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download validated GeoJSON outline"}).click();
    const geoDownload=await geoDownloadPending;
    assert.equal(geoDownload.suggestedFilename(),"preliminary-roof-outline.geojson");
    const exportedGeo=JSON.parse(readFileSync(await geoDownload.path(),"utf8"));
    assert.equal(exportedGeo.properties.status,"preliminary-unverified");
    assert.deepEqual(exportedGeo.geometry.coordinates,[[[-0.4001,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4001,51.8]]]);
    await geoPreview.getByRole("button",{name:"Undo geographic edit",exact:true}).click();
    await geoPreview.getByRole("button",{name:"Save geographic roof revision",exact:true}).click();
    await saved("roof");
    await page.reload();
    await sketch.getByText("Preview georeferenced roof outline",{exact:true}).click();
    await geoPreview.getByRole("status").waitFor();
    assert.equal(await geoPreview.locator("li").count(),3);
    await geoPreview.getByText("Geographic outline matches the saved roof revision.",{exact:true}).waitFor();
    assert.ok(Math.abs(Number(await areaPanel.locator("strong").textContent())-expectedFootprint/1.1)<0.01);
    assert.equal(await diagram.locator("image").count(),0); // local imagery is intentionally not persisted
    const undoDownloadPending=page.waitForEvent("download");
    await geoPreview.getByRole("button",{name:"Download validated GeoJSON outline"}).click();
    const undoDownload=await undoDownloadPending;
    assert.deepEqual(JSON.parse(readFileSync(await undoDownload.path(),"utf8")).geometry.coordinates,JSON.parse(validGeo).coordinates);
    assert.equal(await geoPreview.getByRole("button",{name:"Undo geographic edit",exact:true}).isDisabled(),true);
    await geoPreview.getByRole("button",{name:"Clear geographic preview",exact:true}).click();
    await geoPreview.getByText("Preview cleared; the saved geographic outline is unchanged.",{exact:true}).waitFor();
    assert.equal(await areaPanel.count(),0);
    await geoPreview.getByRole("button",{name:"Restore saved geographic outline",exact:true}).click();
    await geoPreview.getByText("Geographic outline matches the saved roof revision.",{exact:true}).waitFor();
    assert.equal(await geoPreview.locator("li").count(),3);
    assert.equal(await geoPreview.getByRole("button",{name:"Restore saved geographic outline",exact:true}).count(),0);
    await geoPreview.getByRole("button",{name:"Remove saved geographic outline",exact:true}).click();
    await saved("roof");
    await page.reload();
    await sketch.getByText("Preview georeferenced roof outline",{exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),0);
    await geoPreview.getByText("No geographic outline saved.",{exact:true}).waitFor();
    assert.equal(await geoPreview.getByRole("button",{name:"Remove saved geographic outline",exact:true}).count(),0);



    assert.equal(await geoPreview.getByRole("group", {name:"Imported roof outline in longitude and latitude"}).count(),0);
    await geoInput.setInputFiles({name:"bad.geojson",mimeType:"application/json",buffer:Buffer.from('{"type":"Point"}')});
    await geoPreview.getByRole("alert").waitFor();
    assert.equal(await geoPreview.locator("li").count(),0);
    await geoInput.setInputFiles({name:"roof.geojson",mimeType:"application/json",buffer:Buffer.from(validGeo)});
    await geoPreview.getByRole("button",{name:"Clear geographic preview"}).click();
    assert.equal(await geoPreview.locator("li").count(),0);
    assert.equal(await geoInput.inputValue(), "");
    // A delayed replacement must not resurrect a preview the user cleared.
    await geoInput.setInputFiles({name:"roof.geojson",mimeType:"application/json",buffer:Buffer.from(validGeo)});
    await geoPreview.getByText("3 geographic boundary points loaded. Longitude, latitude in degrees; not metres.",{exact:true}).waitFor();
    await page.evaluate(() => {
      window.__originalGeoFileText = File.prototype.text;
      File.prototype.text = function () {
        const file = this;
        return new Promise(resolve => { window.__releaseGeoRead = async () => resolve(await window.__originalGeoFileText.call(file)); });
      };
    });
    try {
      await geoInput.setInputFiles({name:"delayed.geojson",mimeType:"application/json",buffer:Buffer.from(validGeo)});
      assert.equal(await geoPreview.getByRole("button",{name:"Save geographic roof revision",exact:true}).isDisabled(),true);
      await geoPreview.getByText("Reading geographic outline… Save is unavailable until validation finishes.",{exact:true}).waitFor();
      await geoPreview.getByRole("button",{name:"Clear geographic preview"}).click();
      await page.evaluate(async () => { await window.__releaseGeoRead(); });
      assert.equal(await geoPreview.locator("li").count(),0);
      assert.equal(await geoPreview.getByRole("status").count(),0);
      assert.equal(await geoPreview.getByText("Reading geographic outline… Save is unavailable until validation finishes.",{exact:true}).count(),0);
    } finally {
      await page.evaluate(() => { File.prototype.text = window.__originalGeoFileText; delete window.__originalGeoFileText; delete window.__releaseGeoRead; });
    }
    await geoPreview.getByText("Paste GeoJSON boundary",{exact:true}).click();
    await geoPreview.getByLabel("GeoJSON boundary text",{exact:true}).fill(validGeo);
    await geoPreview.getByRole("button",{name:"Import pasted geographic outline",exact:true}).click();
    assert.equal(await geoPreview.locator("li").count(),3);
    assert.equal(await geoPreview.getByLabel("GeoJSON boundary text",{exact:true}).inputValue(),"");
    assert.equal(await geoPreview.getByRole("button",{name:"Import pasted geographic outline",exact:true}).isDisabled(),true);
    await geoPreview.getByRole("button",{name:"Clear geographic preview"}).click();
    // The same local file must be selectable again after clearing the preview.
    await geoInput.setInputFiles({name:"roof.geojson",mimeType:"application/json",buffer:Buffer.from(validGeo)});
    await geoPreview.getByText("3 geographic boundary points loaded. Longitude, latitude in degrees; not metres.",{exact:true}).waitFor();
    assert.equal(await geoPreview.locator("li").count(),3);
    assert.equal(await geoInput.inputValue(), "");
    await geoPreview.getByRole("button",{name:"Clear geographic preview"}).click();

  }

  const downloadButton = sketch.getByRole("button", { name: "Download preliminary measurement record" });
  const calculate = () => sketch.getByRole("button", { name: "Calculate preliminary measurements" }).click();
  async function plot(x, y) {
    const svg = sketch.getByRole("img", {name:"Interactive roof plan sketch: click or tap to add points", exact:true});
    await svg.scrollIntoViewIfNeeded();
    const point = await svg.evaluate((element, coordinates) => {
      const p = new DOMPoint(...coordinates).matrixTransform(element.getScreenCTM());
      return { x: p.x, y: p.y };
    }, [x, y]);
    await page.mouse.click(point.x, point.y);
  }
  async function downloadMeasurement() {
    const pending = page.waitForEvent("download");
    await downloadButton.click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), "preliminary-roof-measurement.json");
    return JSON.parse(readFileSync(await download.path(), "utf8"));
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await sketch.getByRole("button", { name: "Clear sketch", exact: true }).click();
    assert.equal(await downloadButton.count(), 0);
    await sketch.getByRole("button", { name: "1. Draw boundary", exact: true }).click();
    for (const point of [[100, 100], [500, 100], [500, 300], [100, 300]]) await plot(...point);
    await sketch.getByRole("button", { name: "2. Mark calibration", exact: true }).click();
    await plot(100, 100); await plot(500, 100);
    await sketch.getByLabel("Verified calibration distance (metres)").fill("20");
    await sketch.getByLabel("Roof pitch (degrees, optional)").fill("");
    await calculate();
    const record = await downloadMeasurement();
    assert.equal(record.format, "jr-roof-measurement");
    assert.equal(record.version, 1);
    assert.ok(Number.isFinite(Date.parse(record.exportedAt)));
    assert.match(record.limitations, /not an approved survey or payment quantity/);
    assert.equal(record.measurement.status, "preliminary-unverified");
    assert.equal(record.plan.vertices.length, 4);
    assert.equal(record.plan.calibrationPoints.length, 2);
    assert.equal(record.plan.actualDistanceMetres, 20);
    assert.equal(record.plan.pitchDegrees, null);
    assert.equal(record.measurement.surfaceAreaM2, null);
    assert.ok(Math.abs(record.measurement.planAreaM2 - 200) < 0.5);
    assert.ok(Math.abs(record.measurement.perimeterM - 60) < 0.1);
    assert.equal(record.measurement.edgeLengthsM.length, 4);
    await sketch.getByText("Calibration sensitivity", { exact: true }).click();
    await sketch.getByLabel("Calibration distance tolerance ± metres").fill("1");
    const sensitivity = sketch.locator("details").filter({has: page.getByText("Calibration sensitivity", {exact:true})});
    assert.match(await sensitivity.getByRole("status").innerText(), /Plan area range:/);
    assert.match(await sensitivity.getByRole("status").innerText(), /Saved measurements are unchanged/);
    assert.deepEqual((await downloadMeasurement()).measurement, record.measurement);
    await sketch.getByLabel("Calibration distance tolerance ± metres").fill("20");
    await sensitivity.getByRole("alert").waitFor();
    assert.equal(await sensitivity.getByRole("status").count(), 0);
    await sketch.getByLabel("Calibration distance tolerance ± metres").fill("0");
    await sensitivity.getByRole("status").waitFor();

    assert.equal("image" in record, false);
    await sketch.getByLabel("Roof pitch (degrees, optional)").fill("60");
    assert.equal(await downloadButton.count(), 0);
    await calculate();
    const pitched = await downloadMeasurement();
    assert.ok(Math.abs(pitched.measurement.surfaceAreaM2 - 400) < 1);
    await sketch.getByLabel("Verified calibration distance (metres)").fill("10");
    assert.equal(await downloadButton.count(), 0);
    await calculate();
    const rescaled = await downloadMeasurement();
    assert.ok(Math.abs(rescaled.measurement.planAreaM2 - 50) < 0.2);
    await sketch.getByText("Edit boundary points", { exact: true }).click();
    await sketch.getByLabel("Boundary point", { exact: true }).selectOption("2");
    await sketch.getByLabel("Point X (0–1000)").fill("1001");
    await sketch.getByRole("button", { name: "Apply point", exact: true }).click();
    await sketch.getByRole("alert").getByText(/Enter finite coordinates/).waitFor();
    assert.equal((await downloadMeasurement()).plan.vertices[2].x, rescaled.plan.vertices[2].x);
    await sketch.getByLabel("Point X (0–1000)").fill("500");
    await sketch.getByLabel("Point Y (0–600)").fill("500");
    await sketch.getByRole("button", { name: "Apply point", exact: true }).click();
    assert.equal(await downloadButton.count(), 0);
    await calculate();
    const edited = await downloadMeasurement();
    assert.deepEqual(edited.plan.vertices[2], { x: 500, y: 500 });
    assert.ok(Math.abs(edited.measurement.planAreaM2 - 75) < 0.3);
    await sketch.getByRole("button", { name: "Save preliminary roof plan revision", exact: true }).click();
    await saved("roof");
    await page.reload();
    await sketch.getByRole("button", { name: "Calculate preliminary measurements", exact: true }).waitFor();
    await calculate();
    assert.deepEqual((await downloadMeasurement()).plan.vertices[2], { x: 500, y: 500 });
    await sketch.getByText("Edit boundary points", { exact: true }).click();
    await sketch.getByLabel("Boundary point", { exact: true }).selectOption("2");
    await sketch.getByRole("button", { name: "Remove selected point", exact: true }).click();
    assert.equal(await downloadButton.count(), 0);
    await calculate();
    assert.equal((await downloadMeasurement()).plan.vertices.length, 3);
    // Restore the removed corner before testing the existing Undo control.
    await sketch.getByRole("button", { name: "1. Draw boundary", exact: true }).click();
    await plot(50, 200);
    await sketch.getByRole("button", { name: "Undo boundary point", exact: true }).click();
    assert.equal(await downloadButton.count(), 0);
    await calculate();
    assert.equal((await downloadMeasurement()).plan.vertices.length, 3);
    await sketch.getByRole("button", { name: "Clear sketch", exact: true }).click();
    await calculate();
    assert.equal(await downloadButton.count(), 0);
    await sketch.getByRole("alert").waitFor();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const defect = section("Record a defect");
  await choose(defect, "Defect roof", "Main warehouse");
  await choose(defect, "Defect category", "Corrosion / perforation");
  await choose(defect, "Defect severity", "High");
  await fill(defect, {
    "Defect location / grid": "Ridge A1",
    "Affected quantity": 5,
    "Defect evidence description": "Synthetic defect - not a real observation",
    "Recommended action / investigation":
      "Investigate fragility and confirm design before access",
    "Defect technical assumptions / limits":
      "No structural assessment or access approval",
  });
  await choose(defect, "Affected unit", "m");
  await defect
    .getByRole("button", { name: "Save defect", exact: true })
    .click();
  await saved("defect");
  const upload = section("Upload photographic evidence");
  await upload
    .getByRole("button", { name: "Capture current GPS for these photos" })
    .click();
  await upload.getByText(/GPS: 51.880000/).waitFor();
  const defectSelect = upload.getByLabel("Link photograph to defect", { exact: true });
  await defectSelect.selectOption({ label: "Ridge A1 / Corrosion / perforation" });
  await choose(upload, "Photo roof", "Annexe");
  assert.equal(await upload.getByText(/GPS: 51.880000/).count(), 0);
  assert.equal(await upload.getByRole("option", { name: "Ridge A1 / Corrosion / perforation" }).count(), 0);
  await choose(upload, "Photo roof", "Main warehouse");
  assert.equal(await defectSelect.inputValue(), "");
  await upload.getByRole("button", { name: "Capture current GPS for these photos" }).click();
  await upload.getByText(/GPS: 51.880000/).waitFor();
  await fill(upload, { "Photograph caption": "Synthetic roof evidence" });
  await choose(
    upload,
    "Link photograph to defect",
    "Ridge A1 / Corrosion / perforation",
  );
  await upload
    .getByLabel("Photo files (up to 10)", { exact: true })
    .setInputFiles("tests/fixtures/roof.png");
  await upload
    .getByRole("button", { name: "Save photo evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Annotate / revise photo" }).waitFor();
  await page.getByRole("button", { name: "Annotate / revise photo" }).click();
  await page
    .getByLabel("Marked area label", { exact: true })
    .fill("Synthetic corrosion mark");
  const surface = page.getByRole("img", { name: "Photo annotation surface" }),
    box = await surface.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.65, {
    steps: 6,
  });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Save photo annotation revision" })
    .click();
  await page
    .getByText("1 marked areas · revision 2", { exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: /Main warehouse · 100/ }).click();
  await page
    .getByText("1 marked areas · revision 2", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/issue-2-survey-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Materials & Specifications", exact: true })
    .click();
  const material = section("Add material and specification source");
  await fill(material, {
    "Product / material": "Synthetic test roof panel",
    "Manufacturer / generic": "Test manufacturer - not a real product",
    "Manufacturer source URL (HTTPS)": "https://example.invalid/test-datasheet",
    "Source document / reference": "SYNTHETIC-DATASHEET-01",
    "Source revision / edition": "TEST revision A",
    "Source checked date": date,
    "Source review due date": future,
    "Specification, properties and limitations":
      "Synthetic test product. λ properties and technical suitability require verification.",
    "Budget unit rate (£, optional)": "20.00",
    "Rate source / quotation reference":
      "Synthetic test rate - not a commercial quotation",
    "Rate date": date,
  });
  await choose(material, "Material category", "Roof covering");
  await choose(material, "Material unit", "m²");
  await material.getByRole("button", { name: "Save material source" }).click();
  await page
    .getByRole("heading", { name: "Synthetic test roof panel", exact: true })
    .waitFor();
  await page
    .getByLabel("Search materials and source references")
    .fill("DATASHEET-01");
  await page
    .getByRole("heading", { name: "Synthetic test roof panel", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Estimating & Tenders", exact: true })
    .click();
  const estimate = section("New tender option");
  const optionDetails = (title) => ({
    "Option title": title,
    "Included scope": "Synthetic test scope only",
    Exclusions: "Engineering, strengthening and statutory approvals excluded",
    "Pricing and technical assumptions":
      "All rates are synthetic. Re-measure before live use.",
    "Commercial / payment terms": "Test terms - no commercial offer",
    "Quotation valid until": future,
  });
  await fill(estimate, optionDetails("Option A - synthetic overcladding"));
  await choose(
    estimate,
    "Material source 1",
    "Synthetic test roof panel · revision 1",
  );
  await choose(estimate, "Roof for cost line 1", "Main warehouse");
  await choose(estimate, "Quantity basis 1", "Linked measured roof area");
  await fill(estimate, {
    "Description 1": "Synthetic roof covering",
    "Waste % 1": 10,
  });
  for (const [index, category, description, quantity, rate, unit] of [
    [2, "labour", "Labour", 16, 25, "hour"],
    [3, "plant", "Access plant", 2, 150, "day"],
    [4, "scaffold", "Scaffold", 1, 500, "item"],
    [5, "prelims", "Preliminaries", 1, 100, "item"],
  ]) {
    await estimate
      .getByRole("button", { name: "Add cost line", exact: true })
      .click();
    await choose(estimate, "Cost category " + index, category);
    await choose(estimate, "Unit " + index, unit);
    await fill(estimate, {
      ["Description " + index]: description,
      ["Quantity " + index]: quantity,
      ["Unit rate (£) " + index]: rate,
      ["Rate source " + index]: "Synthetic test rate",
      ["Rate date " + index]: date,
    });
  }
  await fill(estimate, {
    "Contingency %": 10,
    "Sales margin %": 20,
    "VAT %": 20,
  });
  await estimate.getByText("£5,775.00", { exact: true }).waitFor();
  await estimate.getByRole("button", { name: "Save tender option" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Option A - synthetic overcladding" })
    .getByRole("cell", { name: "£5,775.00", exact: true })
    .waitFor();
  const second = section("New tender option");
  await fill(second, {
    ...optionDetails("Option B - synthetic local repair"),
    "Description 1": "Synthetic local repair",
    "Quantity 1": 100,
    "Unit rate (£) 1": 10,
    "Rate source 1": "Synthetic test rate",
    "Rate date 1": date,
    "VAT %": 20,
  });
  await second.getByRole("button", { name: "Save tender option" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Option B - synthetic local repair" })
    .getByRole("cell", { name: "£1,200.00", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("row")
    .filter({ hasText: "Option A - synthetic overcladding" })
    .getByRole("cell", { name: "£5,775.00", exact: true })
    .waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "Option B - synthetic local repair" })
    .waitFor();
  const quote = section("Quotation PDFs");
  await quote
    .getByLabel("Document title", { exact: true })
    .fill("Synthetic quotation for independent review");
  await choose(quote, "Quotation option", "Option A - synthetic overcladding");
  await quote.getByRole("button", { name: "Create quotation draft" }).click();
  const draft = quote.getByRole("link", {
    name: "Download draft PDF",
    exact: true,
  });
  await draft.waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const workbookPending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Excel working copy", exact: true }).first().click();
    const workbook = await workbookPending;
    assert.equal(workbook.suggestedFilename(), "jr-roofing-quotation-working-copy.xlsx");
    const workbookBytes = readFileSync(await workbook.path());
    assert.equal(workbookBytes.subarray(0, 4).toString(), "PK\u0003\u0004");
    assert.ok(workbookBytes.includes(Buffer.from("quotation working copy")));
    assert.ok(workbookBytes.includes(Buffer.from("xl/worksheets/sheet1.xml")));
    writeFileSync("artifacts/tender-working-copy.xlsx", workbookBytes);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const downloadPromise = page.waitForEvent("download");
  await draft.click();
  const downloaded = await downloadPromise;
  const bytes = readFileSync(await downloaded.path());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  writeFileSync("artifacts/issue-2-browser-draft.pdf", bytes);
  await page.getByRole("button", { name: "Sign out" }).click();
  await login("survey-reviewer");
  await page.getByRole("button", { name: "Review document for issue" }).click();
  const review = section("Manager review");
  await review
    .getByLabel("Review note and checked limitations")
    .fill(
      "Synthetic reviewer checked PDF, quantities, rate sources, scope and limitations",
    );
  await choose(
    review,
    "Reviewed complete PDF and limitations",
    "Yes - I have reviewed the complete PDF and limitations",
  );
  await review
    .getByRole("button", { name: "Approve exact document snapshot" })
    .click();
  await page
    .getByRole("link", { name: "Download approved PDF", exact: true })
    .waitFor();
  const approvedPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download approved PDF", exact: true })
    .click();
  const approved = await approvedPromise;
  writeFileSync(
    "artifacts/issue-2-browser-approved.pdf",
    readFileSync(await approved.path()),
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["survey", "materials", "estimating"]) {
      await page.goto(base + "/#" + route);
      await page.locator("main h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " overflows at " + width,
      );
      if (width === 390)
        await page.screenshot({
          path: `artifacts/issue-2-${route}-mobile.png`,
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/#estimating");
  await page.screenshot({
    path: "artifacts/issue-2-estimating-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: UI creates project, two roofs, defect, GPS photo, annotation revision, material provenance, sourced category takeoff and two reconciled options; reload persists; draft download and independent approval succeed; desktop/tablet/mobile fit; zero page errors",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  store.close();
  rmSync(folder, { recursive: true });
}
