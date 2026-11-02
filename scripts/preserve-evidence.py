"""Export user-visible session evidence; never copy private reasoning or credentials."""
from pathlib import Path
import os,json,hashlib,datetime,subprocess,re
repo=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,text=True,encoding='utf-8').strip()
def write(path,data):
 p=repo/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
sid=os.environ.get('CODEX_SESSION_ID')
if not sid:raise SystemExit('Run from the original Codex session to preserve its actual ID.')
base=Path(os.environ.get('CODEX_HOME',str(Path.home()/'.codex')))
matches=list((base/'sessions').rglob('*'+sid+'*.jsonl'))
if len(matches)!=1:raise SystemExit('Expected one exact session record; no guessed session export.')
source=matches[0];raw=source.read_bytes();rows=[json.loads(line) for line in raw.decode('utf-8').splitlines() if line]
meta=next(r['payload'] for r in rows if r['type']=='session_meta')
assert sid in [meta.get('id'),meta.get('session_id')]
record={'sessionId':sid,'threadId':os.environ.get('CODEX_THREAD_ID'),'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Actual environment, app list_threads, and exact local session_meta matched','sessionStorePath':str(source),'sessionStoreSnapshotSha256':sha(raw),'sessionStoreSnapshotBytes':len(raw),'metadata':{k:meta.get(k) for k in ['id','session_id','timestamp','cwd','originator','cli_version','source','model_provider']},'exportPolicy':'User messages and assistant commentary/final only. Tool calls/results represented by hashes, not raw payloads. Original raw session retained in Codex session store; not included in shareable archive.','statusCommand':'Interactive /status not run: unavailable in this API; no fabricated output.'}
write('EVIDENCE/session.json',record)
visible=[]
for row in rows:
 p=row.get('payload',{});kind=p.get('type')
 if row['type']!='response_item':continue
 if kind=='message' and (p.get('role')=='user' or (p.get('role')=='assistant' and p.get('phase') in ['commentary','final'])):
  text='\n'.join(c.get('text','') for c in p.get('content',[]) if c.get('type') in ['input_text','output_text'])
  if text:visible.append({'timestamp':row.get('timestamp'),'kind':'message','role':p['role'],'phase':p.get('phase'),'text':text})
 elif kind in ['function_call','function_call_output','custom_tool_call','custom_tool_call_output']:
  payload=json.dumps(p,sort_keys=True,ensure_ascii=False).encode('utf-8')
  visible.append({'timestamp':row.get('timestamp'),'kind':kind,'name':p.get('name'),'callId':p.get('call_id'),'payloadSha256':sha(payload),'payloadBytes':len(payload)})
(repo/'EVIDENCE/session-visible.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in visible),encoding='utf-8')
protected=repo/'src/core/engine.ts';baseline=next(r for r in json.loads((repo/'EVIDENCE/baseline-manifest.json').read_text()) if r['path']=='src/core/engine.ts')
actual=sha(protected.read_bytes());assert actual==baseline['sha256'],'Protected engine/story content changed.'
write('EVIDENCE/protected-content.json',{'file':'src/core/engine.ts','sha256':actual,'baselineSha256':baseline['sha256'],'unchanged':True,'meaning':'Opening 38 chat strings/order and core story/state data identical to historical archive. Missing approved author manuscript not inferred.'})
(repo/'EVIDENCE/git-history.txt').write_text(git('log','--date=iso-strict','--format=fuller','--stat')+'\n',encoding='utf-8')
licenses=[]
for p in sorted((repo/'node_modules').glob('*/package.json'))+sorted((repo/'node_modules').glob('@*/*/package.json')):
 try:d=json.loads(p.read_text(encoding='utf-8'))
 except (ValueError,UnicodeDecodeError):continue
 licenses.append({k:d.get(k) for k in ['name','version','license','repository']})
write('EVIDENCE/dependency-licenses.json',licenses)
artifacts=[]
for p in sorted((repo/'EVIDENCE').rglob('*')):
 if p.is_file() and p.name not in ['artifact-sha256.json'] and 'private' not in p.parts:
  artifacts.append({'path':p.relative_to(repo).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
write('EVIDENCE/artifact-sha256.json',artifacts)
print(json.dumps({'sessionId':sid,'visibleRecords':len(visible),'protectedContentUnchanged':True,'artifactsHashed':len(artifacts),'historyHead':git('rev-parse','HEAD')}))
