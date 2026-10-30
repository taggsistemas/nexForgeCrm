import {useEffect,useId,useRef,useState} from 'react';
import type {ProductView} from '../../../../packages/contracts/src/catalog';
/**
 * Accessible combobox: type a code, description or SKU and pick from the filtered catalog list (mouse, arrows + Enter, or Enter for the first match).
 * The parent supplies the search so each screen keeps its own catalog scope.
 */
export function ProductPicker({label,search,exclude=[],onSelect,disabled=false}:{label:string;search:(text:string,signal:AbortSignal)=>Promise<ProductView[]>;exclude?:readonly string[];onSelect:(product:ProductView)=>void;disabled?:boolean}){
 const [text,setText]=useState(''),[items,setItems]=useState<ProductView[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(0),[loading,setLoading]=useState(false),id=useId(),box=useRef<HTMLDivElement>(null);
 const options=items.filter(item=>!exclude.includes(item.id)).slice(0,12);
 useEffect(()=>{if(!open)return;const controller=new AbortController();setLoading(true);const timer=setTimeout(()=>search(text.trim(),controller.signal).then(rows=>{setItems(rows);setActive(0);}).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLoading(false);}),200);return()=>{controller.abort();clearTimeout(timer);};},[text,open]);
 useEffect(()=>{const close=(event:MouseEvent)=>{if(!box.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[]);
 function choose(product:ProductView|undefined){if(!product)return;onSelect(product);setText('');setOpen(false);}
 return <div className="nf-picker" ref={box}><label htmlFor={id+'-input'}>{label}</label>
  <input id={id+'-input'} role="combobox" aria-expanded={open&&options.length>0} aria-controls={id+'-list'} aria-autocomplete="list" aria-activedescendant={open&&options[active]?id+'-'+options[active]!.id:undefined} autoComplete="off" disabled={disabled} maxLength={80} value={text} placeholder="Digite o código ou a descrição"
   onFocus={()=>setOpen(true)} onChange={event=>{setText(event.target.value);setOpen(true);}}
   onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(value=>Math.min(value+1,Math.max(0,options.length-1)));}else if(event.key==='ArrowUp'){event.preventDefault();setActive(value=>Math.max(0,value-1));}else if(event.key==='Enter'){if(open&&options.length){event.preventDefault();choose(options[active]);}}else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);}}}/>
  {open&&<ul id={id+'-list'} role="listbox" aria-label={label} className="nf-picker-list">{loading&&!options.length?<li className="nf-picker-empty" role="presentation">Buscando…</li>:!options.length?<li className="nf-picker-empty" role="presentation">Nenhum produto encontrado.</li>:
   options.map((item,index)=><li key={item.id} id={id+'-'+item.id} role="option" aria-selected={index===active} className={index===active?'is-active':''} onMouseDown={event=>{event.preventDefault();choose(item);}} onMouseEnter={()=>setActive(index)}><strong>{item.code}</strong><span>{item.description}</span><small>{item.kind==='service'?'Serviço':'Produto'} · {item.unit}</small></li>)}</ul>}
 </div>;
}
