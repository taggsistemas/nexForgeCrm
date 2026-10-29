import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { authorizeCompany, type AuthorizedCompany } from '../../apps/api/src/infrastructure/authorization.js';
import { rejectUnsafeInputKeys } from '../../apps/api/src/infrastructure/request-security.js';
import type { IdentityService } from '../../apps/api/src/modules/identity/service.js';
import { customerRegistrationFixture } from '../fixtures/customer.js';
const origin='http://localhost:5173', companyA='a'.repeat(24),companyB='b'.repeat(24),token='1'.repeat(64);
function identity(permissions=['lead:read','lead:write']) {
  return {login:vi.fn().mockResolvedValue(null),authenticate:vi.fn().mockResolvedValue({context:{userId:'user-a',tenantId:'tenant-a',companyIds:[companyA],permissions},view:{}}),logout:vi.fn()} as unknown as IdentityService;
}
describe('malicious HTTP inputs and tenant authorization',()=>{
  it.each([{email:{$ne:null},password:'a'},{email:'user@example.invalid',password:{$gt:''}},{email:['user@example.invalid'],password:'a'},{email:'user@example.invalid',password:'a',tenantId:'tenant-b'},{email:'user@example.invalid',password:'a',roles:['master']}])('rejects a forged login DTO before calling authentication (%j)',async body=>{
    const service=identity(),app=createApp({origin,databaseReady:()=>true,identity:service});
    expect((await request(app).post('/api/v1/auth/login').set('Origin',origin).send(body)).status).toBe(400);
    expect(service.login).not.toHaveBeenCalled();
  });
  it('rejects reserved keys and deep input; preserves harmless text values',async()=>{
    const app=express();app.use(express.json());app.use(rejectUnsafeInputKeys);app.post('/',(req,res)=>res.json(req.body));
    for(const raw of ['{"__proto__":{"admin":true}}','{"address":{"constructor":{"prototype":{"isMaster":true}}}}','{"nested":{"$where":"true"}}','{"tenant.id":"b"}']){
      expect((await request(app).post('/').set('Content-Type','application/json').send(raw)).status).toBe(400);
    }
    let deep:unknown='leaf';for(let i=0;i<24;i++) deep={nested:deep};
    expect((await request(app).post('/').send(deep as object)).status).toBe(400);
    const text={name:"O'Connor $where <script>alert(1)</script>"};
    expect((await request(app).post('/').send(text)).body).toEqual(text);
    expect(({} as {isMaster?:boolean}).isMaster).toBeUndefined();
  });
  it('rejects privilege and ownership mass assignment in customer creation',async()=>{
    const auth={login:vi.fn(),logout:vi.fn(),authenticate:vi.fn().mockResolvedValue({id:'master'})};
    const clients={create:vi.fn(),list:vi.fn(),setSubscription:vi.fn(),setActive:vi.fn()};
    const app=createApp({origin,databaseReady:()=>true,platform:{auth,clients}});
    const input={...customerRegistrationFixture,name:'Cliente',slug:'cliente',companyName:'Empresa',adminName:'Admin',adminEmail:'admin@example.invalid',adminPassword:'test-password-only'};
    for(const extra of [{tenantId:'b'},{permissions:['*']},{isMaster:true},{admin:{role:'master'}}]){
      expect((await request(app).post('/api/v1/taggmaster/clients').set('Origin',origin).set('Cookie','nf_master_session='+token).send({...input,...extra})).status).toBe(400);
    }
    expect(clients.create).not.toHaveBeenCalled();
  });
  it('requires exact mutation origin and limits body size',async()=>{
    const service=identity(),app=createApp({origin,databaseReady:()=>true,identity:service});
    expect((await request(app).post('/api/v1/auth/login').send({email:'user@example.invalid',password:'p'})).status).toBe(403);
    const large=await request(app).post('/api/v1/auth/login').set('Origin',origin).send({password:'a'.repeat(270000)});
    expect(large.status).toBe(413);expect(large.headers['cache-control']).toBe('no-store');
    expect(service.login).not.toHaveBeenCalled();
  });
  function business(service:IdentityService){
    const app=express();app.use(express.json());app.use(rejectUnsafeInputKeys);
    const rows=[{id:'one',tenantId:'tenant-a',companyId:companyA,name:'A'},{id:'two',tenantId:'tenant-b',companyId:companyB,name:'B'}];
    app.all('/companies/:companyId/records/:id',authorizeCompany(service,'lead:read'),(req,res)=>{
      const {scope}=res.locals.authorizedCompany as AuthorizedCompany;
      const row=rows.find(row=>row.id===req.params.id&&row.tenantId===scope.tenantId&&row.companyId===scope.companyId);
      if(!row){res.status(404).json({code:'NOT_FOUND'});return;}
      res.json(row);
    });
    return app;
  }
  it('does not accept forged identity headers or platform cookie as a tenant session',async()=>{
    const service=identity(),app=business(service);
    for(const cookie of ['', 'nf_master_session='+token]){
      expect((await request(app).get('/companies/'+companyA+'/records/one').set('Cookie',cookie).set('x-tenant-id','tenant-a').set('x-role','master')).status).toBe(401);
    }
    expect(service.authenticate).not.toHaveBeenCalled();
  });
  it('rejects another company for reads, edits and deletes, regardless of supplied headers',async()=>{
    const service=identity(),app=business(service);
    for(const method of ['get','patch','delete'] as const){
      expect((await request(app)[method]('/companies/'+companyB+'/records/two').set('Cookie','nf_session='+token).set('x-tenant-id','tenant-b')).status).toBe(403);
      expect((await request(app)[method]('/companies/'+companyA+'/records/two').set('Cookie','nf_session='+token)).status).toBe(404);
    }
    expect((await request(app).get('/companies/'+companyA+'/records/one').set('Cookie','nf_session='+token).set('x-tenant-id','tenant-b')).body).toMatchObject({tenantId:'tenant-a',name:'A'});
  });
  it('rechecks session, rejects missing permission and validates company id',async()=>{
    const denied=business(identity([]));
    expect((await request(denied).get('/companies/'+companyA+'/records/one').set('Cookie','nf_session='+token)).status).toBe(403);
    const service=identity(),app=business(service);
    expect((await request(app).get('/companies/invalid/records/one').set('Cookie','nf_session='+token)).status).toBe(400);
    vi.mocked(service.authenticate).mockResolvedValue(null);
    expect((await request(app).get('/companies/'+companyA+'/records/one').set('Cookie','nf_session='+token)).status).toBe(401);
  });
});
