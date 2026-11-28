import {geographicImageFrame} from './roof-geojson.ts';
export type ImageMetadata={name:string;mimeType:string;bytes:number;width:number;height:number;sha256:string};
export const imageRecordLimitations='User-supplied source details and bounds; independently verify rights, capture date and alignment. File hash identifies bytes only, not authenticity or survey approval. Image data is not included.';
/** Restore only a bounded, supported record tied to the currently decoded image. */
export function parseReferenceImageRecord(text:string,image:ImageMetadata,points:[number,number][]) {
 if(text.length>100000||new TextEncoder().encode(text).byteLength>100000)throw Error('Image record must be at most 100 KB.');
 const value=JSON.parse(text);
 if(value?.format!=='jr-reference-image'||value.version!==1||value.status!=='preliminary-unverified'||value.crs!=='EPSG:4326'||value.orientation!=='north-up')throw Error('Unsupported preliminary image record.');
 if(!/^[a-f0-9]{64}$/.test(value.image?.sha256??'')||(['sha256','mimeType','bytes','width','height'] as const).some(key=>value.image?.[key]!==image[key]))throw Error('Record does not match the selected image. Select the original image file.');
 const bounds={west:value.bounds?.west,south:value.bounds?.south,east:value.bounds?.east,north:value.bounds?.north};
 geographicImageFrame(points,bounds);
 const optional=(input:unknown,max:number):string|null=>{if(input===null||input===undefined||input==='')return null;if(typeof input!=='string'||input.length>max)throw Error('Invalid image source details.');return input.trim()||null;};
 const sourceReference=optional(value.sourceReference,500),rightsAndAlignmentNotes=optional(value.rightsAndAlignmentNotes,1000),imageDate=optional(value.imageDate,10);
 if(imageDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(imageDate)||!Number.isFinite(Date.parse(imageDate))||new Date(imageDate).toISOString().slice(0,10)!==imageDate))throw Error('Invalid image capture date.');
 return {format:'jr-reference-image',version:1,status:'preliminary-unverified',crs:'EPSG:4326',orientation:'north-up',image:{...image},bounds,sourceReference,imageDate,rightsAndAlignmentNotes,limitations:imageRecordLimitations};
}

/** Persist asserted provenance only; this does not verify image bytes on the server. */
export function parseStoredReferenceImageRecord(text:string,points:[number,number][]) {
 if(text.length>100000||new TextEncoder().encode(text).byteLength>100000)throw Error('Image record must be at most 100 KB.');
 const value=JSON.parse(text),m=value?.image;
 if(!m||typeof m.name!=='string'||!m.name.trim()||m.name.length>255||!['image/png','image/jpeg'].includes(m.mimeType)||
 !Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>10*1024*1024||!Number.isSafeInteger(m.width)||!Number.isSafeInteger(m.height)||m.width<=0||m.height<=0||m.width*m.height>25000000||typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('Invalid reference image metadata.');
 const metadata={name:m.name,mimeType:m.mimeType,bytes:m.bytes,width:m.width,height:m.height,sha256:m.sha256};
 return parseReferenceImageRecord(text,metadata,points);
}
