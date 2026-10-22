import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const launcher=readFileSync('OWNER-PREVIEW-WINDOWS.cmd','utf8');
const setup=readFileSync('scripts/owner-preview-setup.ps1','utf8');
const ready=readFileSync('scripts/open-owner-preview.ps1','utf8');

test('Windows preview checks Node 24, builds and uses the local-only server',()=>{
  assert.match(launcher,/process\.versions\.node/);
  assert.match(launcher,/npm run build/);
  assert.match(launcher,/npm start/);
  assert.match(launcher,/127\.0\.0\.1:3000/);
  assert.doesNotMatch(launcher,/npm run dev/);
});
test('first launch provisions private credentials without hardcoded password or reset',()=>{
  assert.match(launcher,/check-owner-account/);
  assert.match(launcher,/if errorlevel 2 goto fail/);
  assert.match(readFileSync('scripts/check-owner-account.ts','utf8'),/readOnly:true/);
  assert.match(launcher,/owner-preview-setup\.ps1/);
  assert.match(setup,/Read-Host.*-AsSecureString/);
  assert.match(setup,/scripts\/create-user\.ts/);
  assert.doesNotMatch(setup,/Remove-Item|drop table|delete from users/i);
});
test('browser opens only after local HTTP readiness',()=>{
  assert.match(launcher,/open-owner-preview\.ps1/);
  assert.doesNotMatch(launcher,/start "" "http:\/\/127\.0\.0\.1:3000"/);
  assert.match(ready,/Invoke-WebRequest/);
  assert.match(ready,/StatusCode -eq 200/);
  assert.match(ready,/Start-Process \$url/);
});
