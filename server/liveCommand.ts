import {AudienceDirector,type Aid} from './audience.ts';
export interface LiveCommand {eventId:string;broadcasterId:string;viewerIdHash:string;value:Aid;occurredAt:number;}
/** Gate by the EventSub notification send timestamp, not a separately proven chat-send time. */
export function acceptLiveCommand(director:AudienceDirector,event:LiveCommand,acceptedSince:number,receivedAt:number) {
 const window=director.snapshot().window;
 if(!window||!acceptedSince||event.occurredAt<acceptedSince)return false;
 return director.accept({...event,receivedAt,source:'LIVE',type:'KNIGHT_AID',voteWindowId:window.id});
}
