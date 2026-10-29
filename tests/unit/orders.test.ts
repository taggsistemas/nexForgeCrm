import {describe,it,expect} from 'vitest';
import {orderInstallments,orderMargin,orderPendingInstallments,parsePaymentTerms} from '../../packages/contracts/src/orders.js';
import {orderActionInput,orderDirectInput,orderInvoiceInput,orderUpdateInput} from '../../apps/api/src/modules/orders/input.js';
const id='64b7f0c2a1b2c3d4e5f60718';
describe('sales and service order rules',()=>{
 it('splits installments by calendar day and lets the last one absorb rounding',()=>{
  expect(orderInstallments(10000,'2030-01-31',[60,30,90])).toEqual([{dueDate:'2030-03-02',amountCents:3333},{dueDate:'2030-04-01',amountCents:3333},{dueDate:'2030-05-01',amountCents:3334}]);
  expect(orderInstallments(500,'2030-02-10',[])).toEqual([{dueDate:'2030-02-10',amountCents:500}]);
 });
 it('consumes the earliest installments with invoiced amounts for the billing forecast',()=>{
  expect(orderPendingInstallments(9000,4000,'2030-01-01',[0,30,60])).toEqual([{dueDate:'2030-01-31',amountCents:2000},{dueDate:'2030-03-02',amountCents:3000}]);
  expect(orderPendingInstallments(9000,9000,'2030-01-01',[0,30])).toEqual([]);
 });
 it('never fabricates a margin when a line has no cost',()=>{
  expect(orderMargin(10000,[4000,2000])).toEqual({costCents:6000,marginCents:4000,marginPercent:40});
  expect(orderMargin(10000,[4000,null])).toEqual({costCents:null,marginCents:null,marginPercent:null});
  expect(orderMargin(0,[0]).marginPercent).toBeNull();
 });
 it('parses payment terms typed by the seller',()=>{
  expect(parsePaymentTerms('30/60/90')).toEqual([30,60,90]);expect(parsePaymentTerms(' 60, 30 ')).toEqual([30,60]);expect(parsePaymentTerms('0')).toEqual([0]);
  for(const value of ['','30/30','abc','800','1/2/3/4/5/6/7/8/9/10/11/12/13'])expect(parsePaymentTerms(value)).toBeNull();
 });
 it('rejects totals, status, numbers and timestamps from input',()=>{
  const base={partyId:id,items:[{productId:id,quantity:'1.5',unitPriceCents:1000}],expectedDeliveryDate:'2030-01-10',paymentMethod:'boleto',paymentTermDays:[30]};
  expect(orderDirectInput.parse(base).items[0]!.discountCents).toBe(0);
  for(const extra of [{totalCents:1},{status:'confirmado'},{number:'PV-1'},{confirmedAt:'2030-01-01'},{ownerId:id}])expect(orderDirectInput.safeParse({...base,...extra}).success).toBe(false);
  for(const change of [{paymentMethod:'cheque'},{paymentTermDays:[]},{paymentTermDays:[30,30]},{items:[{productId:id,quantity:'0',unitPriceCents:1}]},{items:[{productId:id,quantity:'1.2345',unitPriceCents:1}]}])expect(orderDirectInput.safeParse({...base,...change}).success).toBe(false);
  expect(orderUpdateInput.safeParse({version:0,status:'faturado'}).success).toBe(false);
  expect(orderActionInput.safeParse({version:0,at:'2030-01-01'}).success).toBe(false);
  expect(orderInvoiceInput.safeParse({version:0,number:'1',issueDate:'2030-01-01',amountCents:0}).success).toBe(false);
  expect(orderInvoiceInput.safeParse({version:0,number:'1',issueDate:'2030-01-01',amountCents:10,registeredAt:'2030-01-01'}).success).toBe(false);
 });
});
