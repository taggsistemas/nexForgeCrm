import {test,expect} from '@playwright/test';
import {buildSync} from 'esbuild';
import {readFileSync} from 'node:fs';
const css=['apps/web/src/styles.css','apps/web/src/features/platform/master.css','apps/web/src/nexforge.css','apps/web/src/compact.css'].map(p=>readFileSync(p,'utf8')).join('\n');
// Mount the real React screens over a synthetic read-only API. No customer records.
const bundle=buildSync({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {Relationships} from './apps/web/src/features/relationships/Relationships';
import {Opportunities} from './apps/web/src/features/opportunities/Opportunities';
import {Agenda} from './apps/web/src/features/agenda/Agenda';
import {Catalog} from './apps/web/src/features/catalog/Catalog';
import {TechnicalWorkspace} from './apps/web/src/features/technical/TechnicalWorkspace';
import {FieldVisits} from './apps/web/src/features/field-visits/FieldVisits';
import {Territories} from './apps/web/src/features/territories/Territories';
import {UserAdministration} from './apps/web/src/features/administration/UserAdministration';
import {OfflineWorkspace} from './apps/web/src/features/offline/OfflineWorkspace';
import {MasterPage} from './apps/web/src/features/platform/MasterPage';
import {IdentityPanel,useIdentity} from './apps/web/src/features/identity/IdentityPanel';
import {App} from './apps/web/src/App';
import {profileDefinitions,profileDescriptions,profileKeys} from './packages/contracts/src/profiles';
const Login=()=> <section className="nf-login-card"><IdentityPanel identity={useIdentity()}/></section>;
const account={user:{id:'a'.repeat(24),name:'Pessoa Teste'},tenant:{id:'b'.repeat(24),name:'Empresa demonstrativa'},companies:[{id:'c'.repeat(24),name:'Empresa demonstrativa'}],permissions:['lead:read','lead:write','customer:read','contact:read','contact:write','pipeline:read','pipeline:write','activity:read','activity:write','catalog:read','catalog:manage','technical:read','technical:manage','visit:read','visit:write','region:read','region:manage','portfolio:read','portfolio:manage','user:manage']};
if(window.fixtureName==='coordinationNavigation')account.permissions=[...profileDefinitions.technical_coordinator.permissions];if(window.fixtureName==='directorNavigation')account.permissions=[...profileDefinitions.director.permissions];
window.fetch=async(url)=>String(url).endsWith('/auth/session')||String(url).endsWith('/taggmaster/session')?new Response(JSON.stringify(['navigation','coordinationNavigation','directorNavigation'].includes(window.fixtureName)?account:window.fixtureName==='masterAdmin'?{admin:{id:'a'.repeat(24),name:'Admin Teste',email:'admin@example.invalid'}}:{}),{status:['navigation','coordinationNavigation','directorNavigation','masterAdmin'].includes(window.fixtureName)?200:401}):new Response(JSON.stringify({items:[],total:0,page:1,dailyCounts:[],months:[],qualification:[],profiles:profileKeys.map(key=>({key,...profileDefinitions[key],description:profileDescriptions[key]})),regions:[],customers:[],services:[],technicians:[],cliente:[],regiao:[],vendedor:[],equipe:[]}),{status:200,headers:{'Content-Type':'application/json'}});
const screens={relationships:Relationships,opportunities:Opportunities,agenda:Agenda,catalog:Catalog,technical:TechnicalWorkspace,field:FieldVisits,territories:Territories,offline:OfflineWorkspace,login:Login,master:MasterPage,masterAdmin:MasterPage,navigation:App,coordinationNavigation:App,directorNavigation:App,administration:()=> <UserAdministration companies={account.companies}/>};
const Screen=screens[window.fixtureName];createRoot(document.getElementById('root')).render(<main className="nf-content"><div className="nf-page-heading"><div><span className="nf-breadcrumb">NexForge CRM</span><h1>Área de trabalho</h1></div></div><Screen account={account}/></main>);
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}}).outputFiles[0]!.text;
const screens=[{id:'relationships',open:'+ Novo lead'},{id:'opportunities',open:'Nova oportunidade'},{id:'agenda',open:'Nova atividade'},{id:'catalog',open:'Novo produto ou serviço'},{id:'technical',open:'Agendar serviço'},{id:'field'},{id:'territories'},{id:'administration',open:'Novo usuário'},{id:'offline'},{id:'login'},{id:'master'},{id:'masterAdmin',open:'+ Nova empresa'}];
for(const theme of ['light','dark'])for(const screen of screens)test(`${screen.id}: ${theme} layout and real editor`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<!doctype html><html lang="pt-BR" data-theme="'+theme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div></body></html>');
 await page.evaluate(id=>{(window as unknown as {fixtureName:string}).fixtureName=id;},screen.id);await page.addScriptTag({content:bundle});
 await expect(page.getByRole('heading',{name:'Área de trabalho',exact:true})).toBeVisible();
 if(screen.open){await page.getByRole('button',{name:screen.open,exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('h2')).toBeFocused();
 const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 const badFields=await dialog.locator('input:not([type=checkbox]):not([type=radio]),select,textarea').evaluateAll(fields=>fields.filter(el=>el.getBoundingClientRect().width>el.parentElement!.getBoundingClientRect().width+1).length);expect(badFields).toBe(0);
 await page.screenshot({path:'artifacts/ux/stage1-'+screen.id+'-'+theme+'-'+test.info().project.name+'.png'});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:screen.open,exact:true})).toBeFocused();
 }else await page.screenshot({path:'artifacts/ux/stage1-'+screen.id+'-'+theme+'-'+test.info().project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(errors).toEqual([]);
});

test('mobile navigation traps keyboard focus, closes with Escape and restores the trigger',async({page})=>{
 test.skip(page.viewportSize()!.width>800,'Mobile drawer only');
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div></body></html>');
 await page.evaluate(()=>{(window as unknown as {fixtureName:string}).fixtureName='navigation';});await page.addScriptTag({content:bundle});
 const trigger=page.getByRole('button',{name:'Abrir ou fechar menu'});await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('button',{name:'Fechar menu',exact:true})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#crm-navigation button').last()).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Fechar menu',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');await expect(page.locator('.nf-menu-backdrop')).toHaveCount(0);
});

for(const mode of ['coordinationNavigation','directorNavigation'])test(mode+': profile navigation and allowed actions',async({page})=>{
 await page.setContent('<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div></body></html>');await page.evaluate(id=>{(window as unknown as {fixtureName:string}).fixtureName=id;},mode);await page.addScriptTag({content:bundle});
 await expect(page.getByRole('heading',{name:mode==='coordinationNavigation'?'Coordenação técnica':'Dashboard comercial',exact:true})).toBeVisible();
 if(page.viewportSize()!.width<=800)await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 if(mode==='coordinationNavigation'){
  await expect(page.getByRole('navigation').getByRole('button',{name:'Leads, clientes e contatos'})).toHaveCount(0);await expect(page.getByRole('navigation').getByRole('button',{name:'Catálogo e preços'})).toHaveCount(0);await page.getByRole('navigation').getByRole('button',{name:'Agenda e rota técnica'}).click();await expect(page.getByRole('button',{name:'Agendar serviço',exact:true})).toBeVisible();
 }else{await page.getByRole('navigation').getByRole('button',{name:'Leads, clientes e contatos'}).click();await expect(page.getByRole('button',{name:'+ Novo lead',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);}
});
test('administration explains direction and coordination scope in the real user form',async({page})=>{
 await page.setContent('<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div></body></html>');await page.evaluate(()=>{(window as unknown as {fixtureName:string}).fixtureName='administration';});await page.addScriptTag({content:bundle});await page.getByRole('button',{name:'Novo usuário',exact:true}).click();await page.getByRole('combobox',{name:'Perfil de acesso'}).selectOption('technical_coordinator');await expect(page.getByText('Sem equipe vinculada e regiões ativas',{exact:false})).toBeVisible();await page.getByRole('combobox',{name:'Perfil de acesso'}).selectOption('director');await expect(page.getByText('Aprova qualificações com crédito, propostas e pedidos',{exact:false})).toBeVisible();await expect(page.getByRole('heading',{name:'Regiões de atuação',exact:true})).toHaveCount(0);
});
