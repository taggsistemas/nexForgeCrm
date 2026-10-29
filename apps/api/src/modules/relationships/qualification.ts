import {z} from 'zod';
import {validTaxId} from '../../../../../packages/contracts/src/customer.js';
import {addressInput} from './input.js';
// This schema validates the persisted/merged record, never the PATCH body alone.
export class QualificationRequired extends Error {}
const qualificationInput=z.object({
 stage:z.literal('qualificado'),name:z.string().trim().min(1),contactName:z.string().trim().min(1),
 legalName:z.string().trim().min(1),taxId:z.string().refine(validTaxId),
 email:z.email(),phone:z.string().regex(/^[1-9]\d{9,10}$/),
 address:addressInput.refine(value=>Boolean(value.street&&value.number&&value.neighborhood&&value.city&&value.state&&value.country&&(!['BR','BRASIL','BRAZIL'].includes(value.country.toUpperCase())||value.postalCode)),'Complete o endereço para qualificar.'),
});
export function assertLeadQualified(value:unknown){if(!qualificationInput.safeParse(value).success)throw new QualificationRequired();}

