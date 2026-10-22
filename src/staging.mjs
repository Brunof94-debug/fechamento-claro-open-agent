import {mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {schemas,parseCSV} from './core.mjs';

export async function stageSources(input,root=resolve('.runtime/zetaris-data')) {
  const run='fc_'+randomUUID().replaceAll('-','');
  const directory=join(root,run);await mkdir(directory,{recursive:true});
  const sources={},tables={},manifest={};
  for(const kind of Object.keys(schemas)) {
    const file=input[kind];
    if(!file || typeof file.text!=='string' || typeof file.name!=='string')throw new Error(`Missing ${kind} file.`);
    const rows=parseCSV(file.text,kind,file.name);
    const sha256=createHash('sha256').update(file.text,'utf8').digest('hex');
    const columns=[...schemas[kind],'source_line','evidence_b64','source_sha256'];
    // All business fields have already passed strict scalar validation. Evidence
    // is UTF-8/base64, preserving quoted source cells without CSV-escape ambiguity.
    const csv=[columns.join(','),...rows.map(row=>[...schemas[kind].map(key=>row[key]),row.evidence.line,Buffer.from(JSON.stringify(row.evidence),'utf8').toString('base64'),sha256].join(','))].join('\n')+'\n';
    await writeFile(join(directory,kind+'.csv'),csv,'utf8');
    sources[kind]=rows;
    tables[kind]={name:run+'_'+kind,path:`/home/zetaris/customer-data/shared/fechamento/${run}/${kind}.csv`,columns:columns.map(key=>`${key} ${key.endsWith('_cents')?'BIGINT':key==='source_line'?'INT':'STRING'}`).join(', ')};
    manifest[kind]={name:file.name,sha256TextUTF8:sha256,rows:rows.length};
  }
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
  return {run,directory,sources,tables,manifest};
}
