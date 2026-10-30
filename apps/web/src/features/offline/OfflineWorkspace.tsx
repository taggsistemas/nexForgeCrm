import {businessDateTime,businessDateTimeInput} from '../../../../../packages/contracts/src/business-time';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import type {OfflineParty,OfflinePayload} from '../../../../../packages/contracts/src/offline';
import type {VisitPosition} from '../../../../../packages/contracts/src/field-visits';
import {visitOutcomes} from '../../../../../packages/contracts/src/field-visits';
import {moneyToCents,proposalLineCents} from '../../../../../packages/contracts/src/opportunities';
import {orderPaymentMethodNames,parsePaymentTerms} from '../../../../../packages/contracts/src/orders';
import {paymentMethods} from '../../../../../packages/contracts/src/qualification';
import {clearVault,legacyPending,leaseValid,openVault,updateVault,type QueueEntry,type VaultData} from './vault';
import {enqueue,runEngine,subscribe,type EngineAccount,type EngineStatus} from './engine';
type Editor='activity'|'start'|'finish'|'order'|'ticket';
type Line={productId:string;label:string;quantity:string;price:string;discount:string};
const stateNames:Record<string,string>={pending:'Aguardando envio',applied:'Sincronizado',conflict:'Conflito',rejected:'Recusado',superseded:'Substituído'};
const kindNames:Record<string,string>={activity:'Atividade',visit:'Visita',order:'Pedido',ticket:'Chamado'};
const outcomeNames:Record<string,string>={realizada:'Realizada',contato_ausente:'Contato ausente',cliente_fechado:'Cliente fechado',nao_realizada:'Não realizada'};
const codeNames:Record<string,string>={OFFLINE_CONFLICT:'O cadastro ou a visita mudou no servidor.',OFFLINE_UPLOAD_EXPIRED:'O prazo de 7 dias para envio terminou.',OFFLINE_CAPTURE_OUTSIDE_LEASE:'Registrado fora da validade da autorização offline.',NOT_FOUND:'Cadastro fora da sua carteira atual.',ACCESS_DENIED:'Seu perfil não permite esta operação.',ORDER_CUSTOMER_NOT_APPROVED:'Cliente sem qualificação aprovada para pedidos.',ORDER_INVALID_PRODUCT:'Produto inativo no catálogo.',ORDER_INVALID_QUANTITY:'Quantidade fora das casas decimais do produto.',ORDER_INVALID_LINE:'Desconto maior que o valor da linha.',ORDER_KIND_NOT_ALLOWED:'Seu perfil não trabalha com este tipo de pedido.',TICKET_INVALID_REFERENCE:'Propriedade ou equipamento não pertence mais ao cliente.',INVALID_INPUT:'Dados inválidos.'};
const orderStatusText:Record<string,string>={rascunho:'rascunho',aguardando_aprovacao:'aguardando aprovação',confirmado:'confirmado'};
const when=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const asInput=(cents:number)=>(cents/100).toFixed(2).replace('.',',');
async function locate():Promise<VisitPosition>{if(!isSecureContext||!navigator.geolocation)throw Error('Localização exige HTTPS/localhost e permissão.');return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(value=>resolve({latitude:value.coords.latitude,longitude:value.coords.longitude,accuracy:value.coords.accuracy}),()=>reject(Error('Não foi possível obter localização autorizada. Nada foi registrado.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000}));}
/** Offline field work without any local password: the device vault is prepared and synchronized automatically while signed in online. */
export function OfflineWorkspace({account,onClose,networkUnavailable=false}:{account?:EngineAccount;onClose?:()=>void;networkUnavailable?:boolean}){
 const [data,setData]=useState<VaultData|null>(null),[loaded,setLoaded]=useState(false),[status,setStatus]=useState<EngineStatus|null>(null),[online,setOnline]=useState(navigator.onLine&&!networkUnavailable);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[legacy,setLegacy]=useState(0);
 const [editor,setEditor]=useState<Editor|null>(null),[party,setParty]=useState<OfflineParty|null>(null),[draft,setDraft]=useState<Record<string,string>>({}),[lines,setLines]=useState<Line[]>([]),[authorized,setAuthorized]=useState(false),[formError,setFormError]=useState('');
 const reload=useCallback(async()=>{try{const vault=await openVault();setData(vault?.data??null);}catch(cause){setError((cause as Error).message);}finally{setLoaded(true);}},[]);
 useEffect(()=>{void reload();void legacyPending().then(setLegacy).catch(()=>{});const changed=()=>void reload(),connection=()=>setOnline(navigator.onLine);window.addEventListener('nf-offline-changed',changed);window.addEventListener('online',connection);window.addEventListener('offline',connection);const stop=subscribe(setStatus);
  return()=>{window.removeEventListener('nf-offline-changed',changed);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);stop();};},[reload]);
 useEffect(()=>{setOnline(navigator.onLine&&!networkUnavailable);},[networkUnavailable]);
 const snapshot=data?.snapshot,valid=data?leaseValid(data):false,mine=(row:OfflineParty)=>row.ownerId===snapshot?.identity.userId;
 const scheduled=(partyId:string)=>snapshot?.activities.filter(row=>row.partyId===partyId&&row.type==='visita'&&row.status==='pendente'&&row.fieldState==='none'&&!data!.queue.some(item=>item.payload.kind==='visit'&&item.payload.activityId===row.id&&item.state!=='superseded'))??[];
 function open(kind:Editor,row:OfflineParty|null){setFormError('');setNotice('');setParty(row);setAuthorized(false);setLines([]);
  setDraft({partyId:row?.id??'',title:'',type:'tarefa',notes:'',nextSteps:'',outcome:'realizada',dueLocal:businessDateTimeInput(new Date()),activityId:row?scheduled(row.id)[0]?.id??'':'',delivery:new Date(Date.now()+15*86400000).toISOString().slice(0,10),paymentMethod:'boleto',terms:'30',submit:'yes',propertyId:'',equipmentId:'',criticality:'alto',description:'',product:''});setEditor(kind);}
 async function save(event:FormEvent){
  event.preventDefault();if(!data||!snapshot)return;setBusy(true);setFormError('');
  try{
   const capturedAt=new Date().toISOString(),operationId=crypto.randomUUID(),target=snapshot.parties.find(row=>row.id===(draft.partyId||party?.id));
   if(editor==='finish'){
    const visit=data.draftVisit;if(!visit)throw Error('Não há visita aberta.');if(!authorized)throw Error('Autorize a localização para registrar a saída.');const point=await locate(),at=new Date().toISOString();
    const {grantId,...rest}=visit;await enqueue({...rest,kind:'visit',operationId,capturedAt:at,observedOutAt:at,checkOut:point,locationAuthorized:true,outcome:draft.outcome as typeof visitOutcomes[number],notes:draft.notes!,nextSteps:draft.nextSteps!},grantId,account,next=>({...next,draftVisit:null}));
    setNotice('Visita encerrada e salva no aparelho. Será enviada automaticamente.');
   }else{
    if(!target)throw Error('Selecione um cadastro da carteira.');let payload:OfflinePayload|null=null;
    if(editor==='activity'){const dueAt=businessDateTime(draft.dueLocal!);if(!Number.isFinite(dueAt.valueOf()))throw Error('Confira a data da atividade.');payload={kind:'activity',operationId,partyId:target.id,partyVersion:target.version,capturedAt,title:draft.title!,type:draft.type as 'tarefa',notes:draft.notes!,dueAt:dueAt.toISOString()};}
    else if(editor==='start'){
     if(data.draftVisit)throw Error('Encerre ou descarte a visita aberta antes de iniciar outra.');if(!mine(target))throw Error('A visita deve ser de um cadastro da sua carteira.');if(!authorized)throw Error('Autorize a localização para registrar a entrada.');
     const activity=draft.activityId?snapshot.activities.find(row=>row.id===draft.activityId):undefined,checkIn=await locate();
     await updateVault(current=>({...current,draftVisit:{...(activity?{activityId:activity.id,activityVersion:activity.version}:{}),partyId:target.id,partyVersion:target.version,grantId:current.snapshot.grantId,observedInAt:capturedAt,checkIn},lastSeenAt:Date.now()}));
     setNotice('Entrada registrada no aparelho às '+when(capturedAt)+'. Encerre a visita ao sair.');
    }else if(editor==='order'){
     if(!lines.length)throw Error('Inclua pelo menos um item.');const terms=parsePaymentTerms(draft.terms!);if(!terms)throw Error('Informe os prazos em dias, por exemplo 0 ou 30/60/90.');
     const items=lines.map(line=>{const unitPriceCents=line.price.trim()?moneyToCents(line.price):undefined,discountCents=line.discount.trim()?moneyToCents(line.discount):0;if(unitPriceCents===undefined||discountCents===undefined)throw Error('Confira preço e desconto de '+line.label+'.');try{proposalLineCents(line.quantity.replace(',','.'),unitPriceCents,discountCents);}catch{throw Error('Confira quantidade e desconto de '+line.label+'.');}return {productId:line.productId,quantity:line.quantity.replace(',','.'),unitPriceCents,discountCents};});
     payload={kind:'order',operationId,partyId:target.id,partyVersion:target.version,capturedAt,items,expectedDeliveryDate:draft.delivery!,paymentMethod:draft.paymentMethod!,paymentTermDays:terms,notes:draft.notes!,submit:draft.submit==='yes'};
    }else if(editor==='ticket'){
     if(!draft.propertyId)throw Error('Selecione a propriedade do atendimento.');if((draft.description??'').trim().length<10)throw Error('Descreva o problema com pelo menos 10 caracteres.');
     payload={kind:'ticket',operationId,partyId:target.id,partyVersion:target.version,capturedAt,propertyId:draft.propertyId,equipmentId:draft.equipmentId||null,criticality:draft.criticality as 'alto',title:draft.title!,description:draft.description!};
    }
    if(payload){await enqueue(payload,undefined,account);setNotice(kindNames[payload.kind]+' salvo no aparelho. '+(online?'Enviando ao servidor…':'Será enviado automaticamente quando houver conexão.'));}
   }
   setEditor(null);await reload();
  }catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 async function retry(item:QueueEntry){
  setBusy(true);setError('');
  try{await updateVault(current=>{const target=current.snapshot.parties.find(row=>row.id===item.payload.partyId);if(!target)throw Error('Cadastro fora da sua carteira atual.');let payload:OfflinePayload={...item.payload,operationId:crypto.randomUUID(),partyVersion:target.version};
   if(payload.kind==='visit'&&payload.activityId){const activity=current.snapshot.activities.find(row=>row.id===(item.payload as {activityId:string}).activityId);if(!activity||activity.status!=='pendente'||activity.fieldState!=='none')throw Error('A visita já foi encerrada ou está em atendimento no servidor. Não será sobrescrita.');payload={...payload,activityVersion:activity.version};}
   return {...current,queue:[...current.queue.map(entry=>entry.payload.operationId===item.payload.operationId?{...entry,state:'superseded'} as QueueEntry:entry),{grantId:item.grantId,payload,state:'pending',queuedAt:new Date().toISOString()}]};});
   setNotice('Nova tentativa criada com as versões atuais.');if(account)void runEngine(account);}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 async function discard(item:QueueEntry){if(!window.confirm('Descartar este registro do aparelho? O servidor não será alterado.'))return;try{await updateVault(current=>({...current,queue:current.queue.filter(entry=>entry.payload.operationId!==item.payload.operationId)}));}catch(cause){setError((cause as Error).message);}}
 async function erase(){if(!window.confirm('Apagar os dados offline deste aparelho? Registros ainda não sincronizados serão perdidos; nada muda no servidor.'))return;try{await clearVault();setNotice('Dados offline apagados deste aparelho.');await reload();}catch(cause){setError((cause as Error).message);}}
 async function addProduct(id:string){const product=snapshot?.products?.find(row=>row.id===id);if(!product||lines.some(line=>line.productId===id))return;setLines(current=>[...current,{productId:id,label:product.code+' — '+product.description,quantity:'1',price:product.priceCents===null?'':asInput(product.priceCents),discount:''}]);}
 const preview=(line:Line)=>{try{const price=line.price.trim()?moneyToCents(line.price):undefined,discount=line.discount.trim()?moneyToCents(line.discount):0;return price===undefined||discount===undefined?null:proposalLineCents(line.quantity.replace(',','.'),price,discount);}catch{return null;}};
 const parties=snapshot?.parties.filter(row=>(row.name+' '+row.contactName+' '+row.address).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).slice(0,100)??[];
 const visible=data?.queue.filter(item=>item.state!=='superseded').slice().reverse()??[],draftParty=data?.draftVisit?snapshot?.parties.find(row=>row.id===data.draftVisit!.partyId):null;
 const titles:Record<Editor,string>={activity:'Nova atividade',start:'Iniciar visita',finish:'Encerrar visita',order:'Novo pedido',ticket:'Abrir chamado'};
 return <section className="nf-crm nf-offline">
  <div className="nf-section-heading"><h2>Operação offline</h2>{onClose&&<button className="nf-secondary" onClick={onClose}>Voltar</button>}</div>
  <section className="nf-panel nf-offline-status" aria-live="polite">
   <p><span className={'nf-dot'+(online?'':' offline')} aria-hidden="true"/> {online?'Conectado':'Sem conexão'} · {status?.phase==='syncing'?'Sincronizando…':data?(status?.pending??0)+' registro(s) aguardando envio':'Modo offline ainda não preparado neste aparelho'}</p>
   {data&&snapshot&&<p>{snapshot.identity.userName} · {snapshot.identity.companyName}. Carteira atualizada em {when(snapshot.issuedAt)}{data.lastSyncAt?' · última sincronização '+when(data.lastSyncAt):''}. {valid?'Registros offline permitidos até '+when(snapshot.expiresAt)+'.':'A autorização offline venceu: conecte-se e entre novamente para registrar.'}</p>}
   {status?.message&&<p className="nf-warning">{status.message}</p>}
   {legacy>0&&<p className="nf-warning">Existem {legacy} registro(s) da versão anterior protegidos por senha local. Eles não podem mais ser abertos automaticamente; procure o suporte antes de apagar os dados do navegador.</p>}
   <div className="nf-field-actions">{account&&online&&<button className="nf-primary" disabled={status?.phase==='syncing'} onClick={()=>void runEngine(account)}>Sincronizar agora</button>}{data&&<button className="nf-secondary" onClick={()=>void erase()}>Apagar dados deste aparelho</button>}</div>
   <p className="nf-field-hint">Sem senha: os dados ficam criptografados neste aparelho com uma chave que não sai dele, e são atualizados e enviados automaticamente sempre que houver conexão. Proteja o aparelho com bloqueio de tela. O servidor confere carteira, permissões, preços, crédito e aprovações em cada envio.</p>
  </section>
  {!loaded?<p role="status">Abrindo dados do aparelho…</p>:!data?<section className="nf-panel"><p>{account?'Os dados para uso offline são preparados automaticamente enquanto você está conectado.':'Entre conectado pelo menos uma vez neste aparelho para habilitar o uso offline.'}</p></section>:<>
   {data.draftVisit&&<section className="nf-panel nf-offline-visit"><p><strong>Visita em andamento</strong> · {draftParty?.name??'Cadastro'} desde {when(data.draftVisit.observedInAt)}</p>
    <div className="nf-field-actions"><button className="nf-primary" disabled={!valid} onClick={()=>open('finish',draftParty??null)}>Encerrar visita</button><button className="nf-secondary" onClick={()=>{if(window.confirm('Descartar a visita aberta? Nada será enviado ao servidor.'))void updateVault(current=>({...current,draftVisit:null})).then(reload).catch(cause=>setError((cause as Error).message));}}>Descartar visita</button></div></section>}
   <section className="nf-panel"><h3>Carteira no aparelho</h3><label>Buscar cliente ou lead<input value={search} maxLength={160} onChange={event=>setSearch(event.target.value)}/></label>
    <p className="nf-muted">{snapshot!.parties.length} cadastros · {snapshot!.contacts.length} contatos · {snapshot!.activities.length} atividades (30 dias antes e depois){snapshot!.products?.length?' · '+snapshot!.products.length+' produtos':''}</p>
    <ul className="nf-agenda-list">{parties.map(row=><li key={row.id}><div><strong>{row.name}</strong><p>{[row.contactName,row.phone,row.email].filter(Boolean).join(' · ')}</p>{row.address&&<p>{row.address}</p>}
     {snapshot!.contacts.filter(contact=>contact.partyId===row.id).map(contact=><p key={contact.id}>{contact.name} · {contact.position} · {contact.phone}</p>)}</div>
     <div className="nf-field-actions">{snapshot!.capabilities.activityWrite&&<button className="nf-secondary" disabled={!valid} onClick={()=>open('activity',row)}>Atividade</button>}
      {snapshot!.capabilities.visitWrite&&mine(row)&&!data.draftVisit&&<button className="nf-secondary" disabled={!valid} onClick={()=>open('start',row)}>Iniciar visita</button>}
      {snapshot!.capabilities.orderWrite&&row.orderable&&<button className="nf-secondary" disabled={!valid} onClick={()=>open('order',row)}>Pedido</button>}
      {snapshot!.capabilities.ticketWrite&&snapshot!.properties?.some(item=>item.partyId===row.id)&&<button className="nf-secondary" disabled={!valid} onClick={()=>open('ticket',row)}>Chamado</button>}</div></li>)}</ul>
    {snapshot!.parties.length>parties.length&&<p className="nf-muted">Refine a busca para ver outros cadastros.</p>}</section>
   <section className="nf-panel"><h3>Registros do aparelho</h3>{!visible.length?<p className="nf-muted">Nenhum registro local.</p>:<ul className="nf-agenda-list">{visible.map(item=>{const owner=snapshot!.parties.find(row=>row.id===item.payload.partyId);return <li key={item.payload.operationId}><div>
     <strong>{kindNames[item.payload.kind]} · {owner?.name??'Cadastro fora do acesso atual'}</strong>
     <p><span className="nf-badge">{stateNames[item.state]}</span>{item.number?' '+item.number:''}{item.status?' · '+(orderStatusText[item.status]??item.status):''}{item.code?' · '+(codeNames[item.code]??item.code):''}</p>
     <small>{'title'in item.payload?item.payload.title:item.payload.kind==='visit'?outcomeNames[item.payload.outcome]+' · '+item.payload.notes:item.payload.kind==='order'?item.payload.items.length+' item(ns)':''}{item.queuedAt?' · salvo em '+when(item.queuedAt):''}</small></div>
     <div className="nf-field-actions">{item.state==='conflict'&&owner&&<button className="nf-secondary" disabled={busy||!online} onClick={()=>void retry(item)}>Nova tentativa</button>}{['pending','conflict','rejected'].includes(item.state)&&<button className="nf-secondary" disabled={busy} onClick={()=>void discard(item)}>Descartar</button>}</div></li>;})}</ul>}</section>
  </>}
  {!editor&&error&&<p className="nf-error" role="alert">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <Modal open={Boolean(editor)} title={editor?titles[editor]+(party?' — '+party.name:''):''} busy={busy} onClose={()=>setEditor(null)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}>
    {editor==='activity'&&<><label>Lead ou cliente<select required value={draft.partyId} onChange={event=>setDraft({...draft,partyId:event.target.value})}><option value="">Selecione</option>{snapshot?.parties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
     <div className="nf-admin-grid"><label>Título<input required maxLength={160} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label><label>Tipo<select value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value})}><option value="ligacao">Ligação</option><option value="email">E-mail</option><option value="reuniao">Reunião</option><option value="tarefa">Tarefa</option></select></label>
     <label>Data e hora<input type="datetime-local" required value={draft.dueLocal} onChange={event=>setDraft({...draft,dueLocal:event.target.value})}/></label></div>
     <label>Relato / observações<textarea maxLength={3000} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label></>}
    {editor==='start'&&party&&<><label>Visita<select value={draft.activityId} onChange={event=>setDraft({...draft,activityId:event.target.value})}>{scheduled(party.id).map(row=><option key={row.id} value={row.id}>{row.title} · {when(row.dueAt)}</option>)}<option value="">Visita não agendada</option></select></label></>}
    {editor==='finish'&&<><label>Resultado<select value={draft.outcome} onChange={event=>setDraft({...draft,outcome:event.target.value})}>{visitOutcomes.map(value=><option key={value} value={value}>{outcomeNames[value]}</option>)}</select></label>
     <label>Relato da visita<textarea required maxLength={3000} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label><label>Próximos passos<textarea maxLength={2000} value={draft.nextSteps} onChange={event=>setDraft({...draft,nextSteps:event.target.value})}/></label></>}
    {(editor==='start'||editor==='finish')&&<label className="nf-check"><input type="checkbox" checked={authorized} onChange={event=>setAuthorized(event.target.checked)}/>Autorizo usar a localização do aparelho somente neste registro. A posição é um relato do aparelho, não prova de presença.</label>}
    {editor==='order'&&<><label>Incluir item<select value="" onChange={event=>void addProduct(event.target.value)}><option value="">Selecione um produto ou serviço</option>{snapshot?.products?.filter(row=>!lines.some(line=>line.productId===row.id)).map(row=><option key={row.id} value={row.id}>{row.code} — {row.description}</option>)}</select></label>
     {!lines.length?<p className="nf-muted">Nenhum item incluído.</p>:<div className="nf-table-scroll"><table className="nf-admin-table nf-proposal-items"><thead><tr><th>Item</th><th>Quantidade</th><th>Preço unitário (R$)</th><th>Desconto (R$)</th><th>Total</th><th><span className="nf-sr-only">Remover</span></th></tr></thead><tbody>{lines.map((line,index)=><tr key={line.productId}><td>{line.label}</td>
      {(['quantity','price','discount'] as const).map(key=><td key={key} data-label={key==='quantity'?'Quantidade':key==='price'?'Preço unitário (R$)':'Desconto (R$)'}><input aria-label={(key==='quantity'?'Quantidade de ':key==='price'?'Preço unitário de ':'Desconto de ')+line.label} inputMode="decimal" maxLength={20} value={line[key]} onChange={event=>setLines(current=>current.map((row,position)=>position===index?{...row,[key]:event.target.value}:row))}/></td>)}
      <td data-label="Total">{preview(line)===null?'—':money(preview(line)!)}</td><td><button type="button" className="nf-secondary" onClick={()=>setLines(current=>current.filter((_,position)=>position!==index))}>Remover</button></td></tr>)}</tbody></table></div>}
     <p className="nf-proposal-total">Total previsto: <strong>{money(lines.reduce((sum,line)=>sum+(preview(line)??0),0))}</strong></p>
     <p className="nf-field-hint">Preço sugerido pela tabela geral. Ao sincronizar, o servidor aplica a tabela do cliente, o crédito e as condições aprovadas; fora da regra, o pedido vai para aprovação.</p>
     <div className="nf-admin-grid"><label>Entrega prevista<input type="date" required value={draft.delivery} onChange={event=>setDraft({...draft,delivery:event.target.value})}/></label>
      <label>Forma de pagamento<select value={draft.paymentMethod} onChange={event=>setDraft({...draft,paymentMethod:event.target.value})}>{paymentMethods.map(value=><option key={value} value={value}>{orderPaymentMethodNames[value]}</option>)}</select></label>
      <label>Prazos (dias após a entrega)<input required maxLength={60} inputMode="numeric" value={draft.terms} onChange={event=>setDraft({...draft,terms:event.target.value})}/></label></div>
     <label>Observações<textarea maxLength={3000} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label>
     <label className="nf-check"><input type="checkbox" checked={draft.submit==='yes'} onChange={event=>setDraft({...draft,submit:event.target.checked?'yes':'no'})}/>Enviar para confirmação ao sincronizar (sem marcar, fica como rascunho)</label></>}
    {editor==='ticket'&&party&&<><div className="nf-admin-grid"><label>Propriedade<select required value={draft.propertyId} onChange={event=>setDraft({...draft,propertyId:event.target.value,equipmentId:''})}><option value="">Selecione</option>{snapshot?.properties?.filter(row=>row.partyId===party.id).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Equipamento<select value={draft.equipmentId} disabled={!draft.propertyId} onChange={event=>setDraft({...draft,equipmentId:event.target.value})}><option value="">Não informado</option>{snapshot?.equipment?.filter(row=>row.propertyId===draft.propertyId).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Criticidade<select value={draft.criticality} onChange={event=>setDraft({...draft,criticality:event.target.value})}><option value="critico">Crítico</option><option value="alto">Alto</option><option value="programado">Programado</option></select></label></div>
     <label>Título<input required minLength={3} maxLength={160} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
     <label>Descrição do problema<textarea required minLength={10} maxLength={3000} value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
     <p className="nf-field-hint">A data de abertura do chamado será a do recebimento no servidor.</p></>}
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setEditor(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando…':'Salvar neste aparelho'}</button></div>
   </fieldset></form>
  </Modal>
 </section>;
}
