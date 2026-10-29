import {SubscriptionFields} from './SubscriptionFields';
import {PasswordInput} from '../../components/PasswordInput';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { brazilStates, digits, maskTaxId, maskPhone, maskPostalCode, maskStateRegistration, normalizeTaxId, validTaxId } from '../../../../../packages/contracts/src/customer';
const initial = { taxId: '', stateRegistration: '', phone: '', postalCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'PR', country: 'Brasil' };
type AddressFields = typeof initial;
export function ClientRegistrationForm({ onSubmit, busy, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) {
  const [values, setValues] = useState(initial);
  const [kind, setKind] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [cepStatus, setCepStatus] = useState('');
  const lookup = useRef<AbortController | null>(null);
  const version = useRef(0);
  function update(key: keyof AddressFields, value: string) {
    if (key === 'postalCode' || key === 'country') version.current++;
    setValues(current => ({ ...current, [key]: value }));
  }
  useEffect(() => {
    lookup.current?.abort();
    if (!['BR','BRASIL','BRAZIL'].includes(values.country.toUpperCase()) || digits(values.postalCode).length !== 8) { setCepStatus(''); return; }
    const controller = new AbortController(); lookup.current = controller;
    const snapshot = { ...values };
    const lookupVersion = version.current;
    const timer = setTimeout(async () => {
      setCepStatus('Buscando endereço...');
      const deadline = setTimeout(() => controller.abort('timeout'), 8000);
      try {
        const response = await fetch('https://viacep.com.br/ws/' + digits(snapshot.postalCode) + '/json/', { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error();
        const data = await response.json() as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        if (controller.signal.aborted || lookupVersion !== version.current) return;
        if (data.erro) { setCepStatus('CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.'); return; }
        setValues(current => {
          if (current.postalCode !== snapshot.postalCode || current.country !== snapshot.country) return current;
          return { ...current, street: current.street === snapshot.street ? data.logradouro ?? '' : current.street, neighborhood: current.neighborhood === snapshot.neighborhood ? data.bairro ?? '' : current.neighborhood, city: current.city === snapshot.city ? data.localidade ?? '' : current.city, state: current.state === snapshot.state ? data.uf ?? current.state : current.state };
        });
        setCepStatus('Endereço localizado. Confira os dados e informe número e complemento.');
      } catch {
        if (!controller.signal.aborted || controller.signal.reason === 'timeout') setCepStatus('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
      } finally { clearTimeout(deadline); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [values.postalCode, values.country]);
  useEffect(() => () => lookup.current?.abort(), []);
  function reset() {
    lookup.current?.abort(); version.current++; setValues(initial); setKind('CNPJ'); setCepStatus('');
  }
  function addressField(key: keyof AddressFields, label: string, maxLength: number, required = true) {
    return <label>{label}<input name={key} value={values[key]} required={required} maxLength={maxLength} onChange={event => update(key, event.target.value)} autoComplete="off"/></label>;
  }
  return <form className="master-registration" onSubmit={event => {
    const form = event.currentTarget;
    const document = form.elements.namedItem('taxId') as HTMLInputElement;
    document.setCustomValidity(validTaxId(values.taxId) && normalizeTaxId(values.taxId).length === (kind === 'CPF' ? 11 : 14) ? '' : 'Informe um CPF ou CNPJ válido.');
    const start = (form.elements.namedItem('contractStart') as HTMLInputElement).value;
    const end = form.elements.namedItem('contractEnd') as HTMLInputElement;
    end.setCustomValidity(end.value >= start ? '' : 'O fim do contrato não pode ser anterior ao início.');
    if (!form.reportValidity()) { event.preventDefault(); return; }
    onSubmit(event);
  }} onReset={reset}>
    <fieldset disabled={busy}><legend>Dados da empresa cliente</legend><div className="master-grid">
      <label>Nome fantasia / cliente<input name="name" required maxLength={160}/></label>
      <label>Razão social / nome completo<input name="companyName" required maxLength={160}/></label>
      <label>Código interno da organização<input name="slug" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="cliente-exemplo"/><small>O cliente entra somente com e-mail e senha.</small></label>
      <label>Tipo de documento<select value={kind} onChange={event => { setKind(event.target.value as 'CNPJ' | 'CPF'); update('taxId',''); }}><option>CNPJ</option><option>CPF</option></select></label>
      <label>{kind}<input name="taxId" required maxLength={18} value={values.taxId} onChange={event => { event.target.setCustomValidity(''); update('taxId',maskTaxId(event.target.value,kind)); }} placeholder={kind === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}/></label>
      <label>Inscrição estadual (IE)<input name="stateRegistration" value={maskStateRegistration(values.stateRegistration, values.state)} maxLength={30} onChange={event => update('stateRegistration', event.target.value)} placeholder="Número da IE ou ISENTO"/><small>Formato conforme a UF. Deixe em branco quando não se aplicar.</small></label>
    </div></fieldset>
    <fieldset disabled={busy}><legend>Contato comercial</legend><div className="master-grid">
      <label>Nome do contato<input name="contactName" required maxLength={120} autoComplete="name"/></label>
      <label>E-mail de contato<input name="contactEmail" type="email" required maxLength={254} autoComplete="email" onBlur={event => { event.target.value = event.target.value.trim().toLowerCase(); }}/></label>
      <label>Telefone / WhatsApp com DDD<input name="phone" type="tel" inputMode="tel" required value={values.phone} maxLength={15} onChange={event => update('phone',maskPhone(event.target.value))} placeholder="(42) 99999-9999" autoComplete="tel-national"/></label>
    </div></fieldset>
    <fieldset disabled={busy}><legend>Endereço</legend><div className="master-grid">
      {addressField('country','País',80)}
      <label>CEP<input name="postalCode" required maxLength={20} value={values.postalCode} autoComplete="postal-code" onChange={event => update('postalCode',['BR','BRASIL','BRAZIL'].includes(values.country.toUpperCase()) ? maskPostalCode(event.target.value) : event.target.value)}/><small>Ao informar um CEP brasileiro completo, consultamos o ViaCEP. Apenas o CEP é enviado ao serviço.</small></label>
      <p className="master-field-wide master-cep-status" role="status">{cepStatus}</p>
      {addressField('street','Rua / logradouro',160)}
      {addressField('number','Número',20)}
      {addressField('complement','Complemento',120,false)}
      {addressField('neighborhood','Bairro',120)}
      {addressField('city','Cidade',120)}
      {['BR','BRASIL','BRAZIL'].includes(values.country.toUpperCase()) ? <label>Estado / UF<select name="state" value={values.state} required onChange={event => update('state',event.target.value)}>{brazilStates.map(state => <option key={state}>{state}</option>)}</select></label> : addressField('state','Estado / província',60)}
    </div></fieldset>
    <fieldset disabled={busy}><legend>Administrador do sistema</legend><div className="master-grid">
      <label>Nome do administrador<input name="adminName" required maxLength={120} autoComplete="off"/></label>
      <label>E-mail do administrador<input name="adminEmail" type="email" required maxLength={254} autoComplete="off" onBlur={event => { event.target.value = event.target.value.trim().toLowerCase(); }}/></label>
      <label>Senha temporária<PasswordInput name="adminPassword" required minLength={12} maxLength={1024} autoComplete="new-password"/><small>Mínimo de 12 caracteres. Troca obrigatória no primeiro acesso.</small></label>
      <label>Confirmar senha<PasswordInput name="confirmPassword" required minLength={12} maxLength={1024} autoComplete="new-password"/></label>
    </div></fieldset>
    <fieldset disabled={busy}><SubscriptionFields/></fieldset>
    <fieldset disabled={busy}><legend>Período do contrato</legend><div className="master-grid">
      <label>Início do contrato<input name="contractStart" type="date" required min="1900-01-01" max="9999-12-31" onChange={event => { const end = event.currentTarget.form?.elements.namedItem('contractEnd') as HTMLInputElement; end?.setCustomValidity(''); }}/></label>
      <label>Fim do contrato<input name="contractEnd" type="date" required min="1900-01-01" max="9999-12-31" onChange={event => event.target.setCustomValidity('')}/></label>
    </div></fieldset>
    {error && <p role="alert" className="master-feedback master-error">{error}</p>}
    <div className="master-registration-actions"><button disabled={busy} type="submit">{busy ? 'Cadastrando...' : 'Cadastrar empresa e administrador'}</button></div>
  </form>;
}
