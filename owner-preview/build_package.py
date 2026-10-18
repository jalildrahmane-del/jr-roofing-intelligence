"""Build a portable, offline Windows owner-review ZIP from an exact merged source."""
import argparse, hashlib, json, shutil, subprocess, tempfile, zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def build(source_sha,node_zip,prod_deps,output,work):
    release=json.loads((BASE/'owner-preview/node-release.json').read_text())
    if sha(node_zip)!=release['archiveSha256']: raise RuntimeError('Official Windows Node archive hash mismatch')
    subprocess.run(['git','diff','--exit-code',source_sha,'--','src','server','public','scripts','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts'],cwd=BASE,check=True)
    work.mkdir(parents=True,exist_ok=False)
    original=work/'merged-source.zip'
    subprocess.run(['git','archive','--format=zip','--output',str(original),source_sha],cwd=BASE,check=True)
    source=work/'source'
    with zipfile.ZipFile(original) as z: z.extractall(source)
    root=work/'JR-Roofing-Intelligence-Owner-Review';app=root/'app';app.mkdir(parents=True)
    for folder in ['server','src','scripts']: shutil.copytree(source/folder,app/folder)
    for name in ['package.json','package-lock.json']: shutil.copy2(source/name,app/name)
    if not (BASE/'dist/index.html').is_file(): raise RuntimeError('Build the merged application first')
    shutil.copytree(BASE/'dist',app/'dist')
    if not (prod_deps/'pdfkit/package.json').is_file(): raise RuntimeError('Locked production dependencies required')
    if any(prod_deps.rglob('*.node')): raise RuntimeError('Unexpected platform-specific dependency')
    for name in ['vite','playwright','@sparticuz']:
        if (prod_deps/name).exists(): raise RuntimeError('Development dependencies must not be packaged')
    shutil.copytree(prod_deps,app/'node_modules',ignore=shutil.ignore_patterns('.bin'))
    runtime=root/'runtime';runtime.mkdir()
    prefix='node-v'+release['version']+'-'+release['platform']+'/'
    with zipfile.ZipFile(node_zip) as z:
        (runtime/'node.exe').write_bytes(z.read(prefix+'node.exe'))
        (runtime/'LICENSE.txt').write_bytes(z.read(prefix+'LICENSE'))
    wrapper=root/'owner-preview';wrapper.mkdir();(app/'owner-preview').mkdir()
    for name in ['launch.mjs','runtime.mjs','fictional-roof.png']: shutil.copy2(BASE/'owner-preview'/name,wrapper/name)
    shutil.copy2(BASE/'owner-preview/seed.ts',app/'owner-preview/seed.ts')
    for template,name in [('START.cmd','START JR Roofing.cmd'),('SHOW-LOGINS.cmd','SHOW LOGIN DETAILS.cmd'),('BACK-UP.cmd','BACK UP REVIEW DATA.cmd')]:
        text=(BASE/'owner-preview'/template).read_text();(root/name).write_bytes(text.replace('\r\n','\n').replace('\n','\r\n').encode('ascii'))
    shutil.copy2(BASE/'owner-preview/READ-ME-FIRST.html',root/'READ ME FIRST.html')
    (root/'START HERE.txt').write_bytes(b'1. Right-click the ZIP and choose Extract All.\r\n2. Open the extracted folder. Double-click START JR Roofing.cmd.\r\n3. Double-click SHOW LOGIN DETAILS.cmd and sign in as owner.\r\n\r\nKeep the JR Roofing console window open while reviewing.\r\nNode.js is bundled: no installation, subscriptions or paid services.\r\nSee READ ME FIRST.html for the feature walkthrough and help.\r\n')
    (root/'SOURCE-VERSION.txt').write_text('JR Roofing Intelligence - genuine merged application\nRepository: https://github.com/jalildrahmane-del/jr-roofing-intelligence\nMerged main source: '+source_sha+'\nIncludes Issues 1-3; excludes unmerged Issue 4 and hosting changes.\nPortable Windows x64 Node.js: '+release['version']+'\nOfficial Node ZIP SHA256: '+release['archiveSha256']+'\nApplication server/src/scripts files are copied from the exact git archive.\nFrontend is the production build of that merged source.\nLocal launcher and fictional seed are additional review-package files.\nNo prebuilt database, passwords, API keys or user data are distributed.\n')
    (root/'THIRD-PARTY-NOTICES.txt').write_text('Node.js and its bundled components: runtime/LICENSE.txt (official distribution).\nApplication dependencies: app/node_modules, with original package licenses retained.\nPDF fonts: app/server/assets/FONT-LICENSE.txt.\nApplication source: repository and commit in SOURCE-VERSION.txt.\nFictional roof illustration: synthetic test fixture, not a real inspection image.\nNo endorsement by Node.js/OpenJS Foundation or third-party libraries is implied.\n')
    files=sorted(p for p in root.rglob('*') if p.is_file())
    forbidden=[p for p in files if p.suffix in ['.sqlite','.dpapi','.pem','.jrb'] or p.name.startswith('.env')]
    if forbidden: raise RuntimeError('Private runtime data must not be packaged')
    (root/'FILE-CHECKSUMS.sha256').write_text(''.join(sha(p)+'  '+p.relative_to(root).as_posix()+'\n' for p in files))
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(root.rglob('*')):
            if p.is_file():
                info=zipfile.ZipInfo(str(Path(root.name)/p.relative_to(root)).replace('\\','/'),date_time=(2026,10,18,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes(),compresslevel=9)
    with zipfile.ZipFile(output) as z:
        bad=z.testzip()
        if bad: raise RuntimeError('ZIP integrity check failed: '+bad)
    result={'package':str(output),'sizeBytes':output.stat().st_size,'sha256':sha(output),'source':source_sha,'files':len(files)+1,'folder':str(root)}
    print(json.dumps(result));return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source-sha',required=True);parser.add_argument('--node-zip',type=Path,required=True);parser.add_argument('--production-deps',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--work',type=Path,required=True);args=parser.parse_args()
    build(args.source_sha,args.node_zip.resolve(),args.production_deps.resolve(),args.output.resolve(),args.work.resolve())
