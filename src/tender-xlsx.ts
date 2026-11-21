import type { Pricing } from "./tender.ts";

// Self-contained Office Open XML workbook; no external service or paid library.
const enc = new TextEncoder();
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
function crc32(bytes: Uint8Array) {
 let crc = 0xffffffff;
 for (const b of bytes) { crc ^= b; for(let k=0;k<8;k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
 return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: [string,string][]): Uint8Array {
 const chunks: Uint8Array[] = [], directory: Uint8Array[] = [];
 let offset=0;
 const u16=(v:DataView,p:number,n:number)=>v.setUint16(p,n,true);
 const u32=(v:DataView,p:number,n:number)=>v.setUint32(p,n,true);
 for(const [name,content] of files) {
  const filename=enc.encode(name), data=enc.encode(content), crc=crc32(data);
  const header=new Uint8Array(30+filename.length), h=new DataView(header.buffer);
  u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0x0800);u32(h,14,crc);u32(h,18,data.length);u32(h,22,data.length);u16(h,26,filename.length);
  header.set(filename,30);chunks.push(header,data);
  const central=new Uint8Array(46+filename.length), c=new DataView(central.buffer);
  u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x0800);u32(c,16,crc);u32(c,20,data.length);u32(c,24,data.length);u16(c,28,filename.length);u32(c,42,offset);central.set(filename,46);
  directory.push(central);offset+=header.length+data.length;
 }
 const dirLength=directory.reduce((n,x)=>n+x.length,0), end=new Uint8Array(22), e=new DataView(end.buffer);
 u32(e,0,0x06054b50);u16(e,8,files.length);u16(e,10,files.length);u32(e,12,dirLength);u32(e,16,offset);
 return Uint8Array.from([...chunks,...directory,end].flatMap(x=>Array.from(x)));
}
type Cell = string | number | null;
function sheet(rows: Cell[][]) {
 const cell=(value:Cell,col:number,row:number)=>{
  if(value==null)return "";
  const ref=String.fromCharCode(65+col)+row;
  if(typeof value==="number") {
   if(!Number.isFinite(value))throw Error("Invalid spreadsheet number");
   return `<c r="${ref}"><v>${value}</v></c>`;
  }
  // Inline strings never execute spreadsheet formulas.
  return `<c r="${ref}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`;
 };
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((cells,i)=>`<row r="${i+1}">${cells.map((v,j)=>cell(v,j,i+1)).join("")}</row>`).join("")}</sheetData></worksheet>`;
}
export function tenderXlsx(pricing: Pricing, projectName: string, optionName: string): Uint8Array {
 if(!pricing.lines.length || pricing.lines.length>100)throw Error("Invalid tender lines");
 const rows:Cell[][]=[
  ["JR Roofing Intelligence — quotation working copy"],
  ["Project",projectName],["Option",optionName],
  ["Status","Draft working export; not an approved quotation"],
  ["Category","Description","Unit","Quantity","Waste %","Rate GBP","Extended GBP","Rate source","Rate date"],
  ...pricing.lines.map(l=>[l.category,l.description,l.unit,l.quantityMilli/1000,l.waste,l.ratePence==null?null:l.ratePence/100,l.extendedPence==null?null:l.extendedPence/100,l.rateSource,l.rateDate]),
  ["Direct cost GBP",pricing.directPence==null?null:pricing.directPence/100],
  ["Contingency %",pricing.contingency],["Contingency GBP",pricing.contingencyPence==null?null:pricing.contingencyPence/100],
  ["Sales margin %",pricing.margin],["Profit GBP",pricing.profitPence==null?null:pricing.profitPence/100],
  ["Net quotation GBP",pricing.netPence==null?null:pricing.netPence/100],
  ["VAT %",pricing.vat],["VAT GBP",pricing.vatPence==null?null:pricing.vatPence/100],
  ["Total including VAT GBP",pricing.grossPence==null?null:pricing.grossPence/100]
 ];
 return zip([
  ["[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
  ["_rels/.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ["xl/workbook.xml",`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Quotation" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ["xl/_rels/workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
  ["xl/worksheets/sheet1.xml",sheet(rows)]
 ]);
}
