export interface Preferences {sensitivity:number;invertY:boolean;volume:number;muted:boolean;reducedMotion:boolean;textScale:number;graphicsStyle:number;graphicsChosen:boolean;brightness:number;}
export const DEFAULT_PREFERENCES:Preferences={sensitivity:1,invertY:false,volume:60,muted:false,reducedMotion:false,textScale:1,graphicsStyle:0,graphicsChosen:false,brightness:1.15};
const clamp=(x:unknown,min:number,max:number,fallback:number)=>typeof x==='number'&&Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback;
export function normalizePreferences(value:unknown):Preferences {
 const p=value&&typeof value==='object'?value as Partial<Preferences>:{};
 return {sensitivity:clamp(p.sensitivity,.25,2.5,1),invertY:p.invertY===true,volume:clamp(p.volume,0,100,60),muted:p.muted===true,reducedMotion:p.reducedMotion===true,textScale:clamp(p.textScale,1,1.3,1),graphicsStyle:Math.round(clamp(p.graphicsStyle,0,3,0)),graphicsChosen:p.graphicsChosen===true,brightness:clamp(p.brightness,.75,1.75,1.15)};
}
export function readPreferences():Preferences {try{const value=localStorage.getItem('sun-down-preferences-v1');return value?normalizePreferences(JSON.parse(value)):{...DEFAULT_PREFERENCES,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};}catch{return {...DEFAULT_PREFERENCES};}}
export function savePreferences(p:Preferences) {try{localStorage.setItem('sun-down-preferences-v1',JSON.stringify(normalizePreferences(p)));}catch{}}
export function lookDelta(dx:number,dy:number,p:Pick<Preferences,'sensitivity'|'invertY'>,locked:boolean) {
 return {yaw:dx*.0024*p.sensitivity,pitch:dy*.002*p.sensitivity*(p.invertY?-1:1)};
}
export function normalizedAxes(forward:number,strafe:number){const magnitude=Math.max(1,Math.hypot(forward,strafe));return {forward:forward/magnitude,strafe:strafe/magnitude};}
