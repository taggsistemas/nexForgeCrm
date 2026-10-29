import {dateParts} from './agenda.js';
export const businessTimeZone='America/Sao_Paulo';
export function businessDateTimeInput(value:Date){const parts=dateParts(value,businessTimeZone);return parts.date+'T'+parts.time;}
// Interpret datetime-local as São Paulo wall time, regardless of the device zone.
export function businessDateTime(value:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return new Date(NaN);const target=Date.parse(value+':00Z');let guess=target;for(let i=0;i<5&&Number.isFinite(guess);i++){const instant=new Date(guess),actual=businessDateTimeInput(instant);if(actual===value)return instant;guess+=target-Date.parse(actual+':00Z');}return new Date(NaN);}
