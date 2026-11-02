/** Presentation completion never invokes the historical Scene IV replay wrap. */
export function legacyAdvance(p:{scene:number;beat:number;line:number;beatCount:number;lineCount:number;typing:boolean}) {
 if(p.typing)return 'finish-text';
 if(p.line<p.lineCount-1)return 'next-page';
 if(p.beat<p.beatCount-1)return 'next-beat';
 return p.scene===4?'complete':'next-scene';
}
