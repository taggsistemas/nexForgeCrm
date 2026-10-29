import {describe,it,expect} from 'vitest';
import {subscriptionInput,updateSubscriptionInput} from '../../apps/api/src/modules/licensing/input.js';
import {subscriptionExpired} from '../../apps/api/src/modules/licensing/service.js';
import {Tenant} from '../../apps/api/src/modules/identity/models.js';
import {monthlyEstimate} from '../../packages/contracts/src/subscription.js';
describe('subscription rules',()=>{
 it('defaults to 25 and calculates contracted extras without inventing prices',()=>{
  expect(subscriptionInput.parse({}).licenseLimit).toBe(25);expect(monthlyEstimate(25,null,null)).toEqual({extraLicenses:0,extraMonthlyCents:0,estimatedMonthlyCents:null});expect(monthlyEstimate(30,10000,2000)).toEqual({extraLicenses:5,extraMonthlyCents:10000,estimatedMonthlyCents:20000});expect(monthlyEstimate(26,10000,null).estimatedMonthlyCents).toBeNull();
 });
 it('rejects frontend clocks, usage, fractional limits and negative prices',()=>{
  for(const input of [{licenseLimit:24},{licenseLimit:25.5},{licenseLimit:10001},{trialEndsAt:'2099-01-01'},{activeUsers:0},{extraSeatMonthlyCents:-1},{baseMonthlyCents:1.5},{mode:'free'},{licenseLimit:{$gt:0}}])expect(subscriptionInput.safeParse(input).success).toBe(false);expect(updateSubscriptionInput.safeParse({licenseLimit:30}).success).toBe(false);
 });
 it('expires at the exact server deadline and leaves legacy paid tenants unchanged',()=>{
  const end=new Date('2030-01-31T12:00:00Z'),trial=new Tenant({subscription:{mode:'trial',trialEndsAt:end}});expect(subscriptionExpired(trial,new Date(end.valueOf()-1))).toBe(false);expect(subscriptionExpired(trial,end)).toBe(true);expect(subscriptionExpired(new Tenant())).toBe(false);expect(subscriptionExpired(new Tenant({subscription:{mode:'trial'}}))).toBe(true);
 });
});
