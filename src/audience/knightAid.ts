export type KnightAid={value:'shield'|'torch';remaining:number}|null;
export function stepAid(aid:KnightAid,dt:number):KnightAid {return aid&&aid.remaining>dt?{...aid,remaining:aid.remaining-Math.max(0,dt)}:null;}
export function aidDamage(aid:KnightAid) {return aid?.value==='torch'&&aid.remaining>0?35:25;}
