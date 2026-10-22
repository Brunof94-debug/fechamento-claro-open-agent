import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const credentials=JSON.parse(await readFile('.runtime/zetaris-local-admin.json','utf8'));
const login=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:credentials.email,password:credentials.password}),signal:AbortSignal.timeout(30000)});
const auth=await login.json();
await writeFile('.runtime/zetaris-auth.json',JSON.stringify(auth),'utf8');
const shape=value=>value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,shape(item)])):typeof value;
console.log(JSON.stringify({loginStatus:login.status,shape:shape(auth)},null,2));
if(!login.ok)process.exitCode=1;
if(login.ok) {
  const response=await fetch('http://localhost:3000/api/proxy/query/sql/start',{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${auth.idToken}`,'X-Org-ID':String(auth.orgId),'X-Request-ID':randomUUID()},body:JSON.stringify({select:'select 7 as seven',pageLimit:5}),signal:AbortSignal.timeout(60000)});
  const result=await response.json();
  await writeFile('.runtime/zetaris-probe.json',JSON.stringify(result,null,2),'utf8');
  console.log(JSON.stringify({queryStatus:response.status,records:result.records,totalCount:result.totalCount},null,2));
}
