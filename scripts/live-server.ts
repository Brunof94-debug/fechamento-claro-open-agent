import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {stageSources} from '../src/staging.mjs';
import {loadZetarisClose} from '../src/zetaris.mjs';
import {Nightshift} from '../src/nightshift.mjs';
import {investigate} from '../src/investigator.ts';
const root=resolve('dist'),port=4341;
const sessions=new Map<string,any>();let busy=false;
async function runtime(){
  try {
    const config=JSON.parse(await readFile('.runtime/meterless-client.json','utf8'));
    const token=(await readFile(config.tokenFile,'utf8')).trim();
    return new Nightshift({baseURL:config.baseURL,token});
  }catch{return null;}
}
function json(res:any,status:number,body:any){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(body));}
async function body(req:any) {
  if(req.headers['content-type']!=='application/json')throw new Error('Use JSON for local API requests.');
  let value='';for await(const chunk of req){value+=chunk.toString('utf8');if(Buffer.byteLength(value)>6_200_000)throw new Error('The three source files exceed the supported size.');}
  return JSON.parse(value);
}
const server=createServer(async(req,res)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host||''))return json(res,403,{error:'Local host required.'});
  const origin=req.headers.origin;
  if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin))return json(res,403,{error:'Local origin required.'});
  const url=new URL(req.url||'/','http://127.0.0.1');
  try {
    if(req.method==='GET'&&url.pathname==='/api/status') {
      const client=await runtime();
      return json(res,200,{live:true,nightshift:client?await client.status():{state:'not-configured',modes:[]},zetaris:'Queries are verified when a close runs.'});
    }
    if(req.method==='POST'&&['/api/close','/api/ask'].includes(url.pathname)) {
      if(!origin)return json(res,403,{error:'A browser origin is required.'});
      if(busy)return json(res,409,{error:'A local investigation is already running. Please wait.'});
      const input=await body(req);busy=true;
      try {
        if(url.pathname==='/api/close') {
          const staged=await stageSources(input.files);
          const close=await loadZetarisClose(staged,{cutoff:input.cutoff,currency:input.currency});
          sessions.set(staged.run,{close,investigations:[]});
          if(sessions.size>8)sessions.delete(sessions.keys().next().value!);
          return json(res,200,{run:staged.run,...close});
        }
        const session=sessions.get(input.run);
        if(!session)return json(res,404,{error:'Run the close again before asking a question.'});
        const client=await runtime();
        if(!client)return json(res,503,{error:'Connect Nightshift locally before using the investigator.',code:'not-configured'});
        const answer=await investigate(input.question,session.close,client);
        session.investigations.push(answer);
        await mkdir('.runtime/investigations',{recursive:true});
        await writeFile(`.runtime/investigations/${input.run}.json`,JSON.stringify(session,null,2),'utf8');
        return json(res,200,answer);
      }finally{busy=false;}
    }
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
    const file=resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
    if(!file.startsWith(root+sep))return json(res,403,{error:'Invalid file path.'});
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(content);
  }catch(error:any){json(res,500,{error:error?.code==='ENOENT'?'A required local runtime file is missing. See the local setup guide.':String(error.message).slice(0,500),code:error.code||'local-error'});}
});
server.listen(port,'127.0.0.1',()=>console.log('Fechamento Claro live: http://127.0.0.1:'+port+'/'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
