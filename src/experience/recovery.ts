import type {Journey} from './journey';
/** Resume narrative progress; combat has a fresh, explicit round boundary. */
export function resumeJourney(j:Journey):Journey {return {...j,phase:j.phase==='encounter'?'ready':j.phase};}
