import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const file=path.resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4341,'127.0.0.1',()=>console.log('Fechamento Claro: http://127.0.0.1:4341/'));
