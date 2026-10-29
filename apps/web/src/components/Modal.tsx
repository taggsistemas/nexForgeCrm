import {useEffect,useId,useRef,type ReactNode} from 'react';
export function Modal({open,title,children,onClose,busy=false,dismissible=true}:{open:boolean;title:string;children:ReactNode;onClose:()=>void;busy?:boolean;dismissible?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open)dialog?.showModal();else if(!open&&dialog?.open)dialog.close();},[open]);
 return <dialog ref={ref} className="nf-modal" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(dismissible&&!busy)onClose();}}>
  <div className="nf-modal-heading"><h2 id={titleId}>{title}</h2>{dismissible&&<button type="button" className="nf-secondary" disabled={busy} onClick={onClose} aria-label="Fechar formulário">Fechar</button>}</div>
  {open&&children}
 </dialog>;
}
