import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';
export function PasswordInput(props:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
 const [visible,setVisible]=useState(false),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const form=input.current?.form,hide=()=>setVisible(false);form?.addEventListener('reset',hide);return()=>form?.removeEventListener('reset',hide);},[]);
 return <span className="nf-password-field"><input {...props} ref={input} type={visible?'text':'password'}/><button type="button" className="nf-password-toggle" disabled={props.disabled} aria-label={visible?'Ocultar senha':'Mostrar senha'} aria-pressed={visible} title={visible?'Ocultar senha':'Mostrar senha'} onClick={()=>setVisible(value=>!value)}><svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="m3 3 18 18"/>}</svg></button></span>;
}

