export const catalogUnits=['pc','kg','g','l','ml','m','m2','kit','cx','serv','h'] as const;
export const packagingKinds=['unit','homogeneous','mixed'] as const;
export const pricingScopes=['global','tipo_cliente','regiao','equipe','vendedor','cliente'] as const;
// Highest specificity wins; one active table per scope/target. Missing items fall back.
export const pricePriority=[...pricingScopes].reverse();
export interface ProductView {id:string;code:string;manufacturerSku:string;description:string;kind:'product'|'service';unit:string;quantityDecimals:number;packaging:string;components:{productId:string;quantity:string}[];variableWeight:boolean;estimatedWeightGrams:number|null;ncm:string;cest:string;deliveryDays:number;active:boolean;version:number}
export interface PriceTableView {id:string;name:string;scope:typeof pricingScopes[number];targetId:string;targetName:string;active:boolean;validFrom?:string|null;validUntil?:string|null;version:number;entries:{productId:string;priceCents:number}[]}
export function decimalQuantityValid(value:string,places=3){return /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(value)&&Number(value)>0&&(value.split('.')[1]?.length??0)<=places;}
export function choosePrice(tables:Pick<PriceTableView,'id'|'scope'|'entries'>[],productId:string){for(const scope of pricePriority){const matches=tables.filter(table=>table.scope===scope&&table.entries.some(item=>item.productId===productId));if(matches.length>1)throw Error('AMBIGUOUS_PRICE');if(matches.length){const table=matches[0]!;return {tableId:table.id,scope,priceCents:table.entries.find(item=>item.productId===productId)!.priceCents};}}return null;}

export const catalogUnitNames:Record<string,string>={pc:'Peça (pc)',kg:'Quilograma (kg)',g:'Grama (g)',l:'Litro (l)',ml:'Mililitro (ml)',m:'Metro (m)',m2:'Metro quadrado (m²)',kit:'Kit',cx:'Caixa (cx)',serv:'Serviço (valor fechado)',h:'Hora (h)'};

export function calculateRulePrice(baseCents:number,method:'markup'|'discount'|'margin',rateBps:number){
 if(!Number.isSafeInteger(baseCents)||baseCents<0||baseCents>1e12||!Number.isInteger(rateBps)||rateBps<0||rateBps>100000||(method==='margin'&&rateBps>=10000)||(method==='discount'&&rateBps>10000))throw Error('INVALID_PRICE_RULE');
 const base=BigInt(baseCents),rate=BigInt(rateBps);
 const numerator=method==='margin'?base*10000n:base*(method==='discount'?10000n-rate:10000n+rate);
 const denominator=method==='margin'?10000n-rate:10000n;
 const result=Number((numerator+denominator/2n)/denominator);
 if(!Number.isSafeInteger(result)||result>1e12)throw Error('INVALID_PRICE_RULE');return result;
}
export function priceTableEffective(table:{validFrom?:string|null;validUntil?:string|null},day:string){return (!table.validFrom||table.validFrom<=day)&&(!table.validUntil||table.validUntil>=day);}
