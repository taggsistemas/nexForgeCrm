export interface CustomerAddress {
  postalCode: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string; country: string;
}
export interface CustomerRegistration {
  taxId: string; stateRegistration: string; contactName: string;
  contactEmail: string; phone: string; address: CustomerAddress;
  contract: { start: string; end: string };
}
export const brazilStates = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export const digits = (value: string) => value.replace(/\D/g, '');
export const normalizeTaxId = (value: string) => value.toUpperCase().replace(/[.\/\-\s]/g, '');
export function validTaxId(value: string): boolean {
  const id = normalizeTaxId(value);
  if (/^(.)\1+$/.test(id)) return false;
  if (/^\d{11}$/.test(id)) {
    for (let length = 9; length <= 10; length++) {
      const sum = [...id.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
      if (Number(id[length]) !== (sum * 10 % 11) % 10) return false;
    }
    return true;
  }
  if (!/^[A-Z0-9]{12}\d{2}$/.test(id)) return false;
  for (let length = 12; length <= 13; length++) {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = [...id.slice(0, length)].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index]!, 0);
    const remainder = sum % 11;
    if (Number(id[length]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}
function patternMask(value: string, pattern: string) {
  let result = '', index = 0;
  for (const char of pattern) {
    if (index >= value.length) break;
    result += char === '#' ? value[index++] : char;
  }
  return result;
}
export function maskTaxId(value: string, kind: 'CPF' | 'CNPJ') {
  const clean = kind === 'CPF' ? digits(value).slice(0,11) : value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,14);
  return patternMask(clean, kind === 'CPF' ? '###.###.###-##' : '##.###.###/####-##');
}
export const maskPostalCode = (value: string) => patternMask(digits(value).slice(0,8),'#####-###');
export function maskPhone(value: string) {
  const clean = digits(value).slice(0,11);
  return patternMask(clean, clean.length > 10 ? '(##) #####-####' : '(##) ####-####');
}
export function normalizeStateRegistration(value: string) {
  return value.toUpperCase().replace(/[.\/\-\s]/g,'');
}
export function maskStateRegistration(value: string, state: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20);
  if (/[A-Z]/.test(clean)) return clean;
  const patterns: Record<string,string> = { PR: '###.#####-##', SP: '###.###.###.###', MG: '###.###.###/####', RJ: '##.###.##-#', RS: '###/#######', SC: '###.###.###', ES: '###.###.##-#', DF: '###########-##' };
  const pattern = patterns[state];
  return pattern && clean.length <= pattern.replace(/[^#]/g,'').length ? patternMask(clean,pattern) : clean;
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31'
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
