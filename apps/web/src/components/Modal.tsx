import {useEffect,useId,useRef,type ReactNode} from 'react';
/** Shared dialog: native focus containment, labelled heading and one scrolling body. */
export function Modal({open,title,children,onClose,busy=false,dismissible=true,size='wide'}:{open:boolean;title:string;children:ReactNode;onClose:()=>void;busy?:boolean;dismissible?:boolean;size?:'compact'|'wide'}){
 const ref=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null),titleId=useId();
 useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open){dialog?.showModal();heading.current?.focus({preventScroll:true});}else if(!open&&dialog?.open)dialog.close();},[open]);
 return <dialog ref={ref} className={'nf-modal nf-modal--'+size} aria-labelledby={titleId} aria-busy={busy} onCancel={event=>{if(event.target!==event.currentTarget)return;/* React re-dispatches a nested dialog cancel to its parent; only the top dialog closes. */event.preventDefault();if(dismissible&&!busy)onClose();}}>
  <div className="nf-modal-heading"><h2 ref={heading} tabIndex={-1} id={titleId}>{title}</h2>{dismissible&&<button type="button" className="nf-secondary" disabled={busy} onClick={onClose} aria-label="Fechar formulário">Fechar</button>}</div>
  {open&&<div className="nf-modal-content">{children}</div>}
 </dialog>;
}
