// Nightshift is the only generative provider. Credentials never reach the browser.
const hosts=new Set(['127.0.0.1','localhost','[::1]']);
export function normalizeRuntimeURL(input='http://127.0.0.1:8088/v1') {
  const value=input.trim();
  const url=new URL(value.includes('://')?value:'http://'+value);
  if(!['http:','https:'].includes(url.protocol)||!hosts.has(url.hostname)||url.username||url.password||url.search||url.hash)throw new Error('Use a loopback Nightshift address without credentials or query parameters.');
  if(!['','/','/v1','/v1/','/v1/chat/completions','/v1/models','/healthz'].includes(url.pathname))throw new Error('Unsupported Nightshift URL path.');
  return url.origin+'/v1';
}
export class RuntimeError extends Error {
  constructor(code,message){super(message);this.name='RuntimeError';this.code=code;}
}
export class Nightshift {
  #token;
  constructor({baseURL,token,fetchImpl=fetch}) {
    this.baseURL=normalizeRuntimeURL(baseURL);this.#token=token;this.fetchImpl=fetchImpl;
  }
  async #request(path,body) {
    if(typeof this.#token!=='string'||!this.#token.trim()||this.#token==='rt-local')throw new RuntimeError('unauthorized','Connect the real Nightshift Runtime token on this computer.');
    let response;
    try {
      response=await this.fetchImpl(this.baseURL+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.#token,'meterless-app':'fechamento-claro',...(body?{'Content-Type':'application/json','meterless-scope':'user'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?180000:10000)});
    }catch {throw new RuntimeError('offline','Nightshift did not answer on its local Runtime endpoint.');}
    if([401,403].includes(response.status))throw new RuntimeError('unauthorized','Nightshift refused the Runtime token. Reconnect locally.');
    if(!response.ok)throw new RuntimeError('unavailable',`Nightshift could not serve this request (HTTP ${response.status}). No substitute model was used.`);
    try{return {data:await response.json(),requestId:response.headers.get('x-request-id')};}
    catch {throw new RuntimeError('unavailable','Nightshift returned an unreadable response.');}
  }
  async status() {
    try {
      const {data}=await this.#request('/models');
      const modes=(data.data||[]).map(row=>row.id).filter(id=>typeof id==='string'&&id.startsWith('meterless/'));
      return modes.length?{state:'online',baseURL:this.baseURL,modes}:{state:'offline',baseURL:this.baseURL,modes:[]};
    }catch(error){return {state:error.code||'offline',baseURL:this.baseURL,modes:[]};}
  }
  async chat(messages,{maxTokens=400}={}) {
    const start=performance.now();
    const {data,requestId}=await this.#request('/chat/completions',{model:'meterless/local',messages,temperature:0,max_tokens:maxTokens,stream:false});
    const content=data.choices?.[0]?.message?.content;
    if(typeof content!=='string'||!content.trim())throw new RuntimeError('unavailable','Nightshift returned no text. No explanation was generated.');
    return {content,receipt:{provider:'Meterless Nightshift',route:'meterless/local',model:data.model||null,requestId,usage:data.usage||null,elapsedMs:Math.round(performance.now()-start),generatedAt:new Date().toISOString()}};
  }
}
export async function detectRuntime(token) {
  let unauthorized;
  for(const host of ['127.0.0.1','localhost','[::1]'])for(const port of [8088,8090,8787,11434]) {
    const baseURL=`http://${host}:${port}/v1`;
    const status=await new Nightshift({baseURL,token}).status();
    if(status.state==='online')return status;
    if(status.state==='unauthorized'&&!unauthorized)unauthorized=status;
  }
  return unauthorized||{state:'offline',modes:[]};
}
