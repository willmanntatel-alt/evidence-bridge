import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {collectDiagnostic} from './live.mjs';
const port = 5033;
const origin = `http://127.0.0.1:${port}`;
let active = false;
let latestReport = null;
const files = new Map([['/','index.html'],['/app.mjs','app.mjs']]);
http.createServer(async(req,res)=>{
  const send=(code,body,type='application/json',headers={})=>{res.writeHead(code,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",...headers});res.end(body);};
  if(req.headers.host!==`127.0.0.1:${port}` || (req.headers.origin && req.headers.origin!==origin)) return send(403,'{"error":"Local origin required"}');
  if(req.method!=='GET') return send(405,'{"error":"Read-only endpoint"}');
  const url=new URL(req.url,origin);
  if(files.has(url.pathname)) return send(200,await readFile(new URL(files.get(url.pathname),import.meta.url)),url.pathname==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
  if(url.pathname==='/api/export'){
    if(!latestReport || active) return send(409,'{"error":"Collect evidence before exporting"}');
    return send(200,JSON.stringify(latestReport,null,2)+'\n','application/json',{'content-disposition':'attachment; filename="evidence-bridge.json"'});
  }
  if(url.pathname==='/api/evidence'){
    if(active) return send(429,'{"error":"A lookup is already running"}');
    active=true;
    latestReport=null;
    try {latestReport=await collectDiagnostic(url.searchParams.get('address')??'');send(200,JSON.stringify(latestReport));}
    catch(error){send(502,JSON.stringify({status:'UNAVAILABLE',error:error.message}));}
    finally{active=false;}
    return;
  }
  send(404,'{"error":"Not found"}');
}).listen(port,'127.0.0.1',()=>console.log(`Evidence Bridge: ${origin}`));
