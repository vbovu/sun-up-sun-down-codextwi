import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {createServer as createViteServer} from 'vite';
import {createLocalApp} from './server/app.ts';

const port=Number(process.env.PORT??3000);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
mkdirSync('EVIDENCE/logs',{recursive:true});
const eventLog=process.env.EVENT_LOG??path.join('EVIDENCE','runtime',`twitch-${Date.now()}.jsonl`);
mkdirSync(path.dirname(eventLog),{recursive:true});
const runtime=createLocalApp({clientId:process.env.TWITCH_CLIENT_ID,clientSecret:process.env.TWITCH_CLIENT_SECRET,channel:process.env.TWITCH_CHANNEL??'vbovu',redirectUri:process.env.TWITCH_REDIRECT_URI??'http://localhost:3000/auth/twitch/callback',eventLog});
if(!process.argv.includes('--dev')) {
 runtime.app.use(express.static(path.resolve('dist')));
 runtime.app.get('*',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
}else{
 const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
 runtime.app.use(vite.middlewares);
}
const server=runtime.app.listen(port,'127.0.0.1',()=>console.log(`SUN UP, SUN DOWN local backend: http://localhost:${port}; Twitch ${process.env.TWITCH_CLIENT_ID&&process.env.TWITCH_CLIENT_SECRET?'configured':'awaiting local .env setup'}. No secret values are logged.`));
server.on('error',(error:NodeJS.ErrnoException)=>{console.error(error.code==='EADDRINUSE'?'Port already in use. Stop the other local preview before retrying.':'Local server could not start.');process.exitCode=1;runtime.close();});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{runtime.close();server.close(()=>process.exit(0));});
