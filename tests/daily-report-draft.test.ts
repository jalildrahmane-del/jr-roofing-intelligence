import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyDraftKey, readDailyDraft} from '../src/daily-report-draft.ts';
const image='data:image/png;base64,YQ==';
test('unfinished reports and photos restore without requiring submission fields',()=>{
  const draft={version:1,savedAt:'2026-11-01T12:00:00Z',fields:{day:'2026-11-01',completed:'Part finished',operatives:''},photos:[{image,caption:''}]};
  assert.deepEqual(readDailyDraft(JSON.stringify(draft)),draft);
  assert.equal(readDailyDraft(null),null);
  assert.notEqual(dailyDraftKey('a','b:c'),dailyDraftKey('a:b','c'));
  assert.notEqual(dailyDraftKey('a','p'),dailyDraftKey('b','p'));
  assert.notEqual(dailyDraftKey('a','p'),dailyDraftKey('a','q'));
});
test('malformed drafts reject unsupported versions, fields and unsafe photo URLs',()=>{
  const valid={version:1,savedAt:'2026-11-01T12:00:00Z',fields:{},photos:[]};
  for(const patch of [{version:2},{savedAt:'invalid'},{fields:{workerId:5}},{fields:{completed:'a'.repeat(3001)}},{photos:[{image:'https://example.com/photo',caption:'x'}]},{photos:Array(5).fill({image,caption:'x'})}])
    assert.throws(()=>readDailyDraft(JSON.stringify({...valid,...patch})));
  assert.throws(()=>readDailyDraft('{broken'));
});
