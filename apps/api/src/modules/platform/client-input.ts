import { z } from 'zod';
import { brazilStates, digits, normalizeTaxId, normalizeStateRegistration, validTaxId, validDate } from '../../../../../packages/contracts/src/customer.js';
export const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email().max(254));
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.string().refine(validDate, 'Data inválida.');
export const customerRegistrationSchema = z.object({
  taxId: z.string().trim().max(30).transform(normalizeTaxId).refine(validTaxId, 'CPF/CNPJ inválido.'),
  stateRegistration: z.string().trim().max(30).transform(normalizeStateRegistration).refine(value => value === '' || value === 'ISENTO' || /^[A-Z0-9]{2,20}$/.test(value), 'Inscrição estadual inválida.'),
  contactName: text(120),
  contactEmail: normalizedEmail,
  phone: z.string().trim().max(25).regex(/^[\d()\s-]+$/).transform(digits).refine(value => /^[1-9]\d{9,10}$/.test(value), 'Informe telefone com DDD.'),
  address: z.object({
    postalCode: text(20), street: text(160), number: text(20),
    complement: z.string().trim().max(120).default(''),
    neighborhood: text(120), city: text(120), state: text(60).transform(value => value.toUpperCase()),
    country: text(80),
  }).strict().superRefine((value, ctx) => {
    if (['BR','BRASIL','BRAZIL'].includes(value.country.toUpperCase())) {
      if (!/^\d{5}-?\d{3}$/.test(value.postalCode)) ctx.addIssue({code:'custom',path:['postalCode'],message:'CEP inválido.'});
      if (!(brazilStates as readonly string[]).includes(value.state)) ctx.addIssue({code:'custom',path:['state'],message:'UF inválida.'});
    }
  }).transform(value => ({ ...value, postalCode: ['BR','BRASIL','BRAZIL'].includes(value.country.toUpperCase()) ? digits(value.postalCode) : value.postalCode })),
  contract: z.object({ start: date, end: date }).strict().refine(value => value.end >= value.start, { message: 'O fim do contrato deve ser igual ou posterior ao início.', path: ['end'] }),
}).strict();
export const newClientSchema = customerRegistrationSchema.extend({
  name: text(160), slug: text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  companyName: text(160), adminName: text(120), adminEmail: normalizedEmail,
  adminPassword: z.string().min(12).refine(value => Buffer.byteLength(value,'utf8') <= 1024),
});
export type NewClientInput = z.infer<typeof newClientSchema>;
