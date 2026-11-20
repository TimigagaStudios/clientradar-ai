// Offline handler integration: synthetic records, auth and website evidence.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const plugin = { name: 'offline', setup(b) {
  b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'db', namespace: 'fake' }));
  b.onResolve({ filter: /^\.\/lib\/auth\.js$/ }, () => ({ path: 'auth', namespace: 'fake' }));
  b.onResolve({ filter: /^\.\/lib\/demo-job-process\.js$/ }, () => ({ path: 'processor', namespace: 'fake' }));
  b.onResolve({ filter: /^\.\/_qa-website\.js$/ }, () => ({ path: 'website', namespace: 'fake' }));
  b.onResolve({ filter: /^\.\/_team\.js$/ }, () => ({ path: 'team', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({ loader: 'js', contents: {
    db: 'export const createClient=()=>globalThis.__testDb;',
    auth: 'export async function requireOwner(req,res){if(globalThis.__owner)return true;res.status(401).json({success:false});return false;} export const requireUser=requireOwner;',
    processor: 'export async function processDemoJob(){throw new Error("Not in this test");}',
    website: "export async function readQaWebsite(){return {status:'not_provided',checkedAt:new Date().toISOString(),host:null,emails:[],phones:[]}}",
    team: 'export async function recordTask(info){globalThis.__records.push(info);}',
  }[path] }));
} };
const result = await build({ entryPoints: ['api/demo-jobs.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [plugin] });
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://unit.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock' }); delete process.env.API_AUTH_DISABLED;
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const id = '11111111-1111-1111-1111-111111111111';
const lead = { business_name: 'Internal Test', email: 'person@business.test', phone: '', website: '' };
const initial = { websiteAnalysis: { status: 'partial', checkedAt: '2026-01-01T00:00:00Z', pagesRead: ['/'], linkedPages: [{path:'/private-path',label:'Private',kind:'Other',read:false}], sourcePages:[{host:'site.test',path:'/',title:'Private evidence',heading:null,emails:['private@site.test'],phones:[]}] }, businessName: lead.business_name, hero: { title: 'Guaranteed results' }, about: { body: 'About' }, services: [{ title: 'One', body: 'Two' }], contact: { email: lead.email }, disclaimer: 'Demo', photos: [{kind:'own',url:'https://site.test/old.jpg'}] };
let row = { id, lead_id: 'lead', status: 'ready', content: structuredClone(initial), leads: structuredClone(lead), template_key: 'auto:ultra', demo_url: `/demos/preview/${id}` };
let mutate = null; globalThis.__records = []; globalThis.__owner = true;
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function query() {
  let action = 'read', patch, filters = [], single = false;
  return { select(){return this;}, eq(k,v){filters.push([k,v]);return this;}, order(){return this;}, range(){return this;}, limit(){return this;}, update(v){action='update';patch=v;return this;}, maybeSingle(){single=true;return this;},
    then(resolve) {
      if (action === 'update' && mutate) { const f=mutate; mutate=null; f(); }
      const matches=filters.every(([k,v]) => k === 'content' ? same(row.content,JSON.parse(v)) : row[k] === v);
      let data;
      if (action === 'update') { if(matches){Object.assign(row,structuredClone(patch));data=[{id}];} else data=[]; }
      else data=matches?(single?structuredClone(row):[structuredClone(row)]):(single?null:[]);
      resolve({ data, error: null });
    }
  };
}
globalThis.__testDb = { from(table) { assert.equal(table, 'demo_jobs'); return query(); } };
async function call(method, body={}, query={}) { const res={code:0,result:null,status(n){this.code=n;return this;},json(v){this.result=v;return this;},setHeader(){},send(v){this.result=v;return this;}}; await handler({method,body,query,headers:{}},res); return res; }
globalThis.__owner = false; let r = await call('POST',{action:'qa-recheck',jobId:id}); assert.equal(r.code,401); assert.equal(row.content.qa,undefined);
globalThis.__owner = true; r = await call('POST',{action:'qa-recheck',jobId:id}); assert.equal(r.code,200); assert.equal(r.result.data.qaStatus,'checked'); assert(row.content.qa.issues.some(x=>x.code==='guarantee')); assert(row.content.qa.issues.some(x=>x.code==='website_not_checked')); assert(row.content.qa.issues.some(x=>x.code==='image_rights_need_review')); assert(globalThis.__records.some(x=>x.agentKey==='quality-assurance'));
r = await call('GET',{}, {jobId:id}); assert.equal(r.code,200); assert.equal(r.result.data.content.qa,undefined); assert.equal(r.result.data.content.websiteAnalysis,undefined); assert.equal(r.result.data.content.photos[0].url,'https://site.test/old.jpg');
r = await call('GET'); assert.equal(r.result.data[0].qaStatus,'checked');
const currentVersion = row.content.qa.version; row.content.qa.version = 1;
r = await call('GET'); assert.equal(r.result.data[0].qaStatus,'stale'); row.content.qa.version = currentVersion;
const photoIssues = row.content.qa.issues; row.content.qa.issues = photoIssues.filter(x=>x.code!=='image_rights_need_review');
r = await call('GET'); assert.equal(r.result.data[0].qaStatus,'stale'); row.content.qa.issues = photoIssues;
row.leads.email='new@business.test'; r=await call('GET'); assert.equal(r.result.data[0].qaStatus,'stale');
r=await call('POST',{action:'qa-correct',jobId:id,path:'hero.title',value:'A clear title',fingerprint:row.content.qa.fingerprint,confirm:true}); assert.equal(r.code,409);
row.leads=structuredClone(lead); const fp=row.content.qa.fingerprint;
r=await call('POST',{action:'qa-correct',jobId:id,path:'hero.title',value:'A clear title',fingerprint:fp}); assert.equal(r.code,403);
r=await call('POST',{action:'qa-correct',jobId:id,path:'hero.title',value:'A clear title',fingerprint:fp,confirm:true}); assert.equal(r.code,200); assert.equal(row.content.hero.title,'A clear title');
mutate=()=>{row.content={...row.content,hero:{title:'Concurrent edit'}}}; r=await call('POST',{action:'qa-recheck',jobId:id}); assert.equal(r.code,409); assert.equal(row.content.hero.title,'Concurrent edit');
row.status='queued'; r=await call('POST',{action:'qa-recheck',jobId:id}); assert.equal(r.code,409);
console.log('PASS offline demo handler: owner auth, website evidence status, stale lead/content, explicit correction, CAS and public QA privacy.');
