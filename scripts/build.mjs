import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/app.ts'],bundle:true,format:'esm',platform:'browser',outfile:'dist/app.js',target:['es2022'],plugins:[{name:'no-filesystem-in-browser',setup(b){b.onResolve({filter:/^node:(fs|path)$/},args=>({path:args.path,namespace:'no-fs'}));b.onLoad({filter:/.*/,namespace:'no-fs'},args=>({contents:args.path==='node:path'?'export default {join:(...parts)=>parts.join("/")};':'export default new Proxy({}, {get:()=>()=>{throw new Error("Filesystem persistence is unavailable in this browser workspace")}});',loader:'js'}));}}]});
await Promise.all(['index.html','style.css'].map(file=>copyFile(file,`dist/${file}`)));
console.log('Built browser preview. H-MEM in-memory; no remote connector represented as active.');
