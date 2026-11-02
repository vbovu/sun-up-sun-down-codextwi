export type Source = 'LIVE' | 'DEMO' | 'OFFLINE';
export type Aid = 'shield' | 'torch';
export interface AudienceEvent {
  eventId: string; broadcasterId: string; viewerIdHash: string; receivedAt: number;
  source: 'LIVE'|'DEMO'; type: 'KNIGHT_AID'; value: Aid; voteWindowId: string;
}
export interface VoteWindow {
  id: string; durationMs: number; remainingMs: number; tally: Record<Aid,number>;
}
export interface Result {
  id: string; value: Aid; source: Source; voters: number; fallback: boolean;
}
export function parseCommand(value: unknown): Aid|null {
  if (typeof value!=='string' || value.length>64) return null;
  const command=value.trim().toLowerCase();
  return command==='!shield'?'shield':command==='!torch'?'torch':null;
}
export class AudienceDirector {
  private source:Source='OFFLINE';
  private window:VoteWindow|null=null;
  private result:Result|null=null;
  private paused=false;
  private serial=0;
  private previous:number;
  private voters=new Set<string>();
  private seen=new Map<string,number>();
  private cooldown=new Map<string,number>();
  constructor(private now:()=>number=()=>performance.now()) { this.previous=now(); }
  setSource(source:Source) {
    if(this.source!==source) { this.cancel(); this.source=source; }
  }
  open():VoteWindow {
    this.tick();
    if(this.window) return this.snapshot().window!;
    this.result=null; this.voters.clear(); this.previous=this.now();
    this.window={id:`vote-${++this.serial}`,durationMs:12000,remainingMs:12000,tally:{shield:0,torch:0}};
    return this.snapshot().window!;
  }
  cancel() { this.window=null; this.result=null; this.voters.clear(); this.previous=this.now(); }
  setPaused(paused:boolean) { this.tick(); this.paused=paused; this.previous=this.now(); }
  tick() {
    const now=this.now(), elapsed=Math.max(0,now-this.previous); this.previous=now;
    if(!this.window||this.paused) return;
    this.window.remainingMs=Math.max(0,this.window.remainingMs-elapsed);
    if(this.window.remainingMs===0) {
      const {id,tally}=this.window, voters=tally.shield+tally.torch;
      this.result={id,value:tally.torch>tally.shield?'torch':'shield',source:this.source,voters,fallback:voters===0};
      this.window=null;
    }
  }
  accept(input:unknown):boolean {
    this.tick();
    if(!input||typeof input!=='object'||!this.window||this.paused||this.source==='OFFLINE') return false;
    const e=input as AudienceEvent, now=this.now();
    if(e.source!==this.source || e.type!=='KNIGHT_AID' || e.voteWindowId!==this.window.id || !['shield','torch'].includes(e.value)) return false;
    for(const s of [e.eventId,e.broadcasterId,e.viewerIdHash]) if(typeof s!=='string'||s.length<1||s.length>200) return false;
    if(!Number.isFinite(e.receivedAt)||e.receivedAt>now+1000||now-e.receivedAt>5000) return false;
    if(this.seen.has(e.eventId)) return false;
    // Record rejected repeats too, so a cooldown-rejected delivery cannot be replayed later.
    this.seen.set(e.eventId,now);
    if(this.seen.size>10000) this.seen.delete(this.seen.keys().next().value!);
    if(this.voters.has(e.viewerIdHash)||now-(this.cooldown.get(e.viewerIdHash)??-Infinity)<750) return false;
    if(this.voters.size>=5000) return false;
    this.voters.add(e.viewerIdHash); this.cooldown.set(e.viewerIdHash,now);
    if(this.cooldown.size>10000) this.cooldown.delete(this.cooldown.keys().next().value!);
    this.window.tally[e.value]++; return true;
  }
  snapshot() {
    return {source:this.source,paused:this.paused,window:this.window?{...this.window,tally:{...this.window.tally}}:null,result:this.result?{...this.result}:null};
  }
}
