import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),envFile=path.join(root,'.env');
const secrets=fs.existsSync(envFile)?fs.readFileSync(envFile,'utf8').split(/\r?\n/).filter(l=>/^(TWITCH_CLIENT_SECRET|TWITCH_ACCESS_TOKEN|TWITCH_REFRESH_TOKEN)=/.test(l)).map(l=>l.slice(l.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'')).filter(s=>s.length>=8):[];
const violations=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(entry.name)||entry.name==='.env'||entry.name.startsWith('.env.'))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(ts|tsx|mjs|cjs|js|json|jsonl|md|txt|html|css)$/.test(file)){const text=fs.readFileSync(file,'utf8');if(secrets.some(s=>text.includes(s)))violations.push(path.relative(root,file));}}}
walk(root);
const gitignore=fs.readFileSync('.gitignore','utf8');if(!gitignore.includes('.env*'))violations.push('.env ignore rule missing');
if(violations.length){console.error(JSON.stringify({status:'FAIL',files:violations}));process.exitCode=1;}else console.log(JSON.stringify({status:'PASS',observed:'Configured secret values absent from source, dist and evidence. .env ignore rule present.',configuredSecretCount:secrets.length,limit:secrets.length?'Exact configured-value scan; not a general certification of all possible credential formats.':'No real Twitch credentials configured; absence cannot establish future live-session hygiene.'}));
