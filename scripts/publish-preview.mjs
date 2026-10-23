// Publishes only the three built static assets. Full integrations run locally.
import {mkdir,copyFile,writeFile,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
const exec=promisify(execFile),directory=resolve('.runtime/pages-publish');
const remote='https://github.com/Brunof94-debug/fechamento-claro-open-agent.git';
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'',SSH_ASKPASS:'',GCM_INTERACTIVE:'never'};
const git=async(...args)=>(await exec('git',args,{cwd:directory,env,timeout:60000})).stdout;
await mkdir(directory,{recursive:true});
let initialized=true;try{await access(resolve(directory,'.git'));}catch{initialized=false;}
if(!initialized){
  await git('init','-b','gh-pages');
  await git('remote','add','origin',remote);
  await git('config','user.name','Bruno Fernandes');
  await git('config','user.email','Brunof94-debug@users.noreply.github.com');
  await git('config','credential.https://github.com.username','Brunof94-debug');
  await git('config','credential.https://github.com.useHttpPath','false');
  const branches=await git('ls-remote','--heads','origin','gh-pages');
  if(branches.trim()){await git('fetch','origin','gh-pages');await git('reset','--soft','FETCH_HEAD');}
}
for(const file of ['index.html','app.js','style.css'])await copyFile(resolve('dist',file),resolve(directory,file));
await writeFile(resolve(directory,'.nojekyll'),'','utf8');
await git('add','index.html','app.js','style.css','.nojekyll');
const changes=await git('status','--porcelain');
if(changes.trim())await git('commit','-m','Publish the static evidence preview');
console.log(await git('push','-u','origin','gh-pages'));
console.log('Static assets published to gh-pages. Verify the GitHub Pages deployment separately.');
