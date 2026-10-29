import {describe,it,expect} from 'vitest';
import {indicatorCsv,indicatorText,percent,type IndicatorReport} from '../../packages/contracts/src/indicators.js';
import {indicatorInput} from '../../apps/api/src/modules/indicators/service.js';
describe('indicator definitions',()=>{
 it('returns null instead of a fabricated zero when there is no denominator',()=>{expect(percent(1,3)).toBe(33.3);expect(percent(0,0)).toBeNull();expect(percent(2,2)).toBe(100);});
 it('formats values by unit for screen and CSV',()=>{
  expect(indicatorText({key:'a',label:'',value:4500000,unit:'cents',definition:''})).toBe('R$ 45.000,00');
  expect(indicatorText({key:'a',label:'',value:95,unit:'minutes',definition:''})).toBe('1 h 35 min');
  expect(indicatorText({key:'a',label:'',value:33.3,unit:'percent',definition:''})).toBe('33,3%');
  expect(indicatorText({key:'a',label:'',value:null,unit:'percent',definition:''})).toBe('sem base');
 });
 it('exports the same values with escaped quotes and the period',()=>{
  const report:IndicatorReport={asOf:'2030-01-01T00:00:00Z',view:'comercial',filters:{startDate:'2030-01-01',endDate:'2030-01-31',regionId:null,ownerId:null},sections:[{key:'carteira',title:'Carteira',indicators:[{key:'c',label:'Clientes "ativos"',value:3,unit:'count',definition:'Definição'}]}]};
  const csv=indicatorCsv(report).split('\r\n');expect(csv[1]).toBe('"Carteira";"Clientes ""ativos""";"3";"Definição"');expect(csv.at(-1)).toContain('2030-01-01 a 2030-01-31');
 });
 it('accepts only the shared filters and bounded periods',()=>{
  expect(indicatorInput.parse({})).toEqual({view:'gerencial'});
  for(const raw of [{startDate:'2030-02-01',endDate:'2030-01-01'},{startDate:'2030-01-01',endDate:'2031-06-01'},{regionId:'castro'},{tenantId:'a'.repeat(24)},{view:'financeiro'}])expect(indicatorInput.safeParse(raw).success).toBe(false);
 });
});
