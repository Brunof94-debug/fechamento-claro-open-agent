import {readFile,writeFile} from 'node:fs/promises';
import {loadZetarisClose} from '../src/zetaris.mjs';
import {demo} from '../src/fixtures.mjs';
const staged=JSON.parse(await readFile('.runtime/demo-staged.json','utf8'));
const close=await loadZetarisClose(staged,demo);
await writeFile('evidence/zetaris-close.json',JSON.stringify(close,null,2),'utf8');
console.log(JSON.stringify({executed:close.zetaris.executed,summary:close.result.summary,queries:close.zetaris.receipts.length},null,2));
