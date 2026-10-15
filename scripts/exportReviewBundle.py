"""Export a private review source ZIP, excluding secret files and unused media."""
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/exportReviewBundle.py /path/to/review-source.zip')
if subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain']).strip():
    raise SystemExit('Commit or preserve pending work before exporting an exact source snapshot')
commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD']).decode().strip()
paths = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode().split('\0')
manifest = {'source_commit': commit, 'publication_authorized': False, 'root_license_selected': False,
            'files': [], 'excluded': []}
target = Path(sys.argv[1]).resolve()
target.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(filter(None, paths)):
        path = Path(name)
        if name.startswith(('public/', '.bolt/')) or name in ('windsurf_test.txt', 'docs/historical-vision.md') or (path.name.startswith('.env') and path.name != '.env.example'):
            manifest['excluded'].append(name)
            continue
        data = (root / path).read_bytes()
        manifest['files'].append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        archive.writestr(name, data)
    archive.writestr('REVIEW-MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
    archive.writestr('REVIEW-ONLY.txt', 'Private review package. Root license/publication rights remain unresolved. The bundled archived sponsor response is synthetic-session evidence; opening the UI makes no new provider call. No release or submission is authorized.\n')
print(json.dumps({'archive': str(target), 'source_commit': commit, 'included': len(manifest['files']),
                  'excluded': len(manifest['excluded']), 'publication_authorized': False}))
