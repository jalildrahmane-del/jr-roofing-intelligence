import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSitePhoto} from '../src/site-photo.ts';

test('site photo uses image element fallback and revokes object URL without createImageBitmap', async () => {
  const globals = globalThis as any;
  const original = {createImageBitmap:globals.createImageBitmap, URL:globals.URL, Image:globals.Image, document:globals.document};
  let revoked = '', drawn = false;
  try {
    globals.createImageBitmap = undefined;
    globals.URL = {...original.URL, createObjectURL: ()=>'blob:test-photo', revokeObjectURL:(url:string)=>{revoked=url;}};
    globals.Image = class {
      naturalWidth=2000; naturalHeight=1000; src='';
      async decode() { assert.equal(this.src,'blob:test-photo'); }
    };
    globals.document = {createElement: () => ({width:0,height:0,getContext:()=>({drawImage:()=>{drawn=true;}}),toDataURL:()=> 'data:image/jpeg;base64,AA=='})};
    const result=await prepareSitePhoto({type:'image/jpeg',size:100} as File);
    assert.equal(result,'data:image/jpeg;base64,AA==');
    assert.equal(drawn,true);
    assert.equal(revoked,'blob:test-photo');
  } finally {Object.assign(globals,original);}
});

test('site photo releases object URL after failed decoding', async () => {
  const globals=globalThis as any;
  const original={createImageBitmap:globals.createImageBitmap,URL:globals.URL,Image:globals.Image};
  let revoked='';
  try {
    globals.createImageBitmap=undefined;
    globals.URL={...original.URL,createObjectURL:()=> 'blob:bad-photo',revokeObjectURL:(url:string)=>{revoked=url;}};
    globals.Image=class {src='';async decode(){throw Error('Invalid image');}};
    await assert.rejects(prepareSitePhoto({type:'image/png',size:100} as File),/Invalid image/);
    assert.equal(revoked,'blob:bad-photo');
  } finally {Object.assign(globals,original);}
});
