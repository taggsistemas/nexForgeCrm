import {qualificationStates} from '../../../../../packages/contracts/src/qualification.js';
import {z} from 'zod';
import {brazilStates,digits,normalizeTaxId,normalizeStateRegistration,validTaxId} from '../../../../../packages/contracts/src/customer.js';
import {customerTypes,leadStages,partyListKinds,contactRoles,contactChannels,equipmentStatuses} from '../../../../../packages/contracts/src/relationships.js';
export const objectId=z.string().regex(/^[a-f0-9]{24}$/i).transform(value=>value.toLowerCase());
const optionalText=(max:number)=>z.string().trim().max(max).default('');
const email=optionalText(254).refine(value=>!value||z.email().safeParse(value).success).transform(value=>value.toLowerCase());
const phone=optionalText(25).refine(value=>!value||/^[\d()\s-]+$/.test(value)).transform(digits).refine(value=>!value||/^[1-9]\d{9,10}$/.test(value));
export const addressInput=z.object({
 postalCode:optionalText(20),street:optionalText(160),number:optionalText(20),complement:optionalText(120),neighborhood:optionalText(120),city:optionalText(120),state:optionalText(60).transform(value=>value.toUpperCase()),country:z.string().trim().min(2).max(80).default('Brasil'),
}).strict().superRefine((value,ctx)=>{
 if(['BR','BRASIL','BRAZIL'].includes(value.country.toUpperCase())){
  if(value.postalCode&&!/^\d{5}-?\d{3}$/.test(value.postalCode))ctx.addIssue({code:'custom',path:['postalCode'],message:'CEP inválido.'});
  if(value.state&&!(brazilStates as readonly string[]).includes(value.state))ctx.addIssue({code:'custom',path:['state'],message:'UF inválida.'});
 }
}).transform(value=>({...value,postalCode:['BR','BRASIL','BRAZIL'].includes(value.country.toUpperCase())?digits(value.postalCode):value.postalCode}));
const optionalId=objectId.nullable();
const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(value+'T00:00:00Z');return !Number.isNaN(date.valueOf())&&date.toISOString().startsWith(value);});
/** Classification and follow-up shared by lead intake and customer maintenance. Option IDs are validated against live company lists. */
const classificationFields={originId:optionalId.optional(),segmentId:optionalId.optional(),classificationId:optionalId.optional(),potentialId:optionalId.optional(),nextActionDate:calendarDate.nullable().optional(),nextActionDescription:z.string().trim().max(300).optional()};
const partyFields={
 name:z.string().trim().min(1).max(160),contactName:optionalText(120),legalName:optionalText(160),
 taxId:optionalText(30).transform(normalizeTaxId).refine(value=>!value||validTaxId(value)),
 stateRegistration:optionalText(30).transform(normalizeStateRegistration).refine(value=>!value||value==='ISENTO'||/^[A-Z0-9]{2,20}$/.test(value)),
 email,phone,customerType:z.enum(customerTypes).default('outro'),stage:z.enum(leadStages).default('novo'),
 address:addressInput.default({postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:'',country:'Brasil'}),
 notes:optionalText(3000),ownerId:objectId.optional(),...classificationFields,technicalOwnerId:optionalId.optional(),
};
export const createPartyInput=z.object(partyFields).strict();
const addressPatch=z.object(Object.fromEntries(Object.entries({postalCode:20,street:160,number:20,complement:120,neighborhood:120,city:120,state:60,country:80}).map(([key,max])=>[key,z.string().trim().max(max).optional()]))).strict();
export const updatePartyInput=z.object({...partyFields,address:addressPatch.optional()}).partial().extend({version:z.number().int().min(0)}).strict();
export const versionInput=z.object({version:z.number().int().min(0)}).strict();
export const convertInput=z.object({version:z.number().int().min(0),customerType:z.enum(customerTypes)}).strict();
const contactFields={name:z.string().trim().min(1).max(120),email,phone,position:optionalText(120),notes:optionalText(3000),roles:z.array(z.enum(contactRoles)).max(contactRoles.length).refine(values=>new Set(values).size===values.length).default([]),preferredChannel:z.enum(['',...contactChannels]).default(''),communicationConsent:z.boolean().default(false)};
export const createContactInput=z.object(contactFields).strict();
export const updateContactInput=z.object(contactFields).partial().extend({version:z.number().int().min(0)}).strict();
export const listInput=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),search:z.string().trim().max(80).default(''),stage:z.enum(leadStages).optional(),qualificationState:z.enum(qualificationStates).optional()}).strict();

export const intakeFields={name:partyFields.name,contactName:partyFields.contactName,email:partyFields.email,phone:partyFields.phone,address:partyFields.address,notes:partyFields.notes,ownerId:partyFields.ownerId,...classificationFields,stage:z.enum(['novo','em_contato','descartado']).default('novo')};
export const createLeadInput=z.object(intakeFields).strict().refine(value=>Boolean(value.phone||value.email),'Informe telefone ou e-mail.');
export const updateLeadInput=z.object({...intakeFields,address:addressPatch.optional()}).partial().extend({version:z.number().int().min(0)}).strict();
export const listOptionCreateInput=z.object({kind:z.enum(partyListKinds),label:z.string().trim().min(1).max(80),order:z.number().int().min(0).max(1000).default(0)}).strict();
export const listOptionUpdateInput=z.object({label:z.string().trim().min(1).max(80).optional(),active:z.boolean().optional(),order:z.number().int().min(0).max(1000).optional(),version:z.number().int().min(0)}).strict();
const coordinate=(limit:number)=>z.number().finite().min(-limit).max(limit).transform(value=>Math.round(value*1e6)/1e6);
/** Typed coordinates of the property record; never treated as proof of presence. */
const coordinatesInput=z.object({latitude:coordinate(90),longitude:coordinate(180)}).strict().nullable();
const propertyFields={name:z.string().trim().min(1).max(120),regionId:objectId.nullable().default(null),address:addressInput.default({postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:'',country:'Brasil'}),coordinates:coordinatesInput.default(null),contactIds:z.array(objectId).max(50).refine(values=>new Set(values).size===values.length).default([]),notes:optionalText(2000)};
export const propertyCreateInput=z.object(propertyFields).strict();
export const propertyUpdateInput=z.object({...propertyFields,address:addressPatch.optional()}).partial().extend({version:z.number().int().min(0)}).strict();
export const propertyListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),search:z.string().trim().max(80).default('')}).strict();
const equipmentFields={propertyId:objectId,categoryId:objectId.nullable().default(null),brand:z.string().trim().min(1).max(80),model:z.string().trim().min(1).max(120),serialNumber:z.string().trim().max(80).default(''),status:z.enum(equipmentStatuses).default('em_operacao'),installedAt:calendarDate.nullable().default(null),warrantyUntil:calendarDate.nullable().default(null),supplier:optionalText(120),notes:optionalText(2000)};
const warrantyAfterInstall=(value:{installedAt?:string|null;warrantyUntil?:string|null})=>!value.installedAt||!value.warrantyUntil||value.warrantyUntil>=value.installedAt;
export const equipmentCreateInput=z.object(equipmentFields).strict().refine(warrantyAfterInstall,{path:['warrantyUntil']});
export const equipmentUpdateInput=z.object(equipmentFields).partial().extend({version:z.number().int().min(0)}).strict();
export const equipmentListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),search:z.string().trim().max(80).default(''),propertyId:objectId.optional()}).strict();
/** Serial comparison ignores case, spaces and separators so "AB-12 3" and "ab123" are the same equipment. */
export const serialKey=(value:string)=>value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'');
