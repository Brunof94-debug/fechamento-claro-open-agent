// Run only after the owner authorizes this app to use the existing local token.
// This does not create a key, alter Runtime security settings or expose a port.
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {normalizeRuntimeURL} from '../src/nightshift.mjs';
const tokenFile=process.argv[2],baseURL=normalizeRuntimeURL(process.argv[3]);
if(!tokenFile)throw new Error('Provide the existing Nightshift proxy-token path. Never paste the token as a command argument.');
if(!(await stat(tokenFile)).isFile())throw new Error('The existing token file was not found.');
await mkdir('.runtime',{recursive:true});
await writeFile('.runtime/meterless-client.json',JSON.stringify({baseURL,tokenFile:resolve(tokenFile)},null,2),'utf8');
console.log('Saved the private local connection path. No token was printed or copied into source.');
