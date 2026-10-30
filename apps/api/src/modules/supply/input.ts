import {z} from 'zod';
import {objectId} from '../relationships/input.js';
import {calendarDate} from '../opportunities/input.js';
import {validTaxId} from '../../../../../packages/contracts/src/customer.js';
import {stockManualReasons,purchaseActions} from '../../../../../packages/contracts/src/supply.js';
const text=(max:number)=>z.string().trim().max(max).default('');
const taxId=z.string().trim().transform(value=>value.replace(/\D/g,'')).refine(value=>value===''||validTaxId(value),'CPF ou CNPJ inválido.');
const email=z.string().trim().max(160).refine(value=>value===''||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),'E-mail inválido.').default('');
export const addressInput=z.object({street:text(160),number:text(20),complement:text(80),district:text(80),city:text(80),state:z.string().trim().toUpperCase().refine(value=>value===''||/^[A-Z]{2}$/.test(value)).default(''),zip:z.string().trim().refine(value=>value===''||/^\d{5}-?\d{3}$/.test(value)).default('')}).strict();
/** Logo is converted to JPEG in the browser (white background) so it embeds directly in PDFs; at most ~300 KB. */
const logo=z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/).max(420000).nullable();
export const companyProfileInput=z.object({version:z.number().int().min(0),legalName:z.string().trim().min(2).max(160),tradeName:text(160),taxId:taxId.refine(value=>value.length!==11,'Use o CNPJ da empresa.'),stateRegistration:text(30),municipalRegistration:text(30),address:addressInput,phone:text(40),email,website:text(160),logo,documentNotes:text(1000),purchaseApprovalLimitCents:z.number().int().min(0).max(1e13)}).strict();
const supplierFields={name:z.string().trim().min(2).max(160),tradeName:text(160),taxId,stateRegistration:text(30),contactName:text(120),phone:text(40),email,address:addressInput.default({street:'',number:'',complement:'',district:'',city:'',state:'',zip:''}),paymentTerms:text(300),notes:text(2000),active:z.boolean().default(true)};
export const supplierInput=z.object(supplierFields).strict();
export const supplierUpdateInput=z.object(supplierFields).partial().extend({version:z.number().int().min(0)}).strict();
export const supplierListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),search:z.string().trim().max(80).default(''),active:z.enum(['true','false','all']).default('true')}).strict();
const quantity=z.string().trim().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/).refine(value=>Number(value)>0);
export const stockListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),search:z.string().trim().max(80).default(''),filter:z.enum(['all','negative','stocked']).default('all')}).strict();
export const movementListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),productId:objectId.optional(),source:z.enum(['manual','compra','pedido_venda','os']).optional()}).strict();
export const manualMovementInput=z.object({productId:objectId,direction:z.enum(['entrada','saida']),quantity,reason:z.enum(stockManualReasons),note:z.string().trim().min(3).max(1000)}).strict();
const purchaseItemInput=z.object({productId:objectId,quantity,unitCostCents:z.number().int().min(0).max(1e12)}).strict();
const purchaseFields={supplierId:objectId,items:z.array(purchaseItemInput).min(1).max(100),expectedDate:calendarDate,paymentTerms:text(300),notes:text(3000)};
export const purchaseInput=z.object(purchaseFields).strict();
export const purchaseUpdateInput=z.object(purchaseFields).partial().extend({version:z.number().int().min(0)}).strict();
export const purchaseActionInput=z.object({version:z.number().int().min(0),note:z.string().trim().max(1000).default('')}).strict();
export const purchaseReceiveInput=z.object({version:z.number().int().min(0),lines:z.array(z.object({productId:objectId,quantity}).strict()).min(1).max(100),note:text(1000)}).strict();
export const purchaseListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),status:z.enum(['open','all','rascunho','aguardando_aprovacao','aprovado','enviado','recebido_parcial','recebido','cancelado']).default('open'),search:z.string().trim().max(80).default(''),supplierId:objectId.optional()}).strict();
export const purchaseActionNames=purchaseActions;
export class SupplyRuleRejected extends Error {constructor(readonly code:string){super(code);}}
