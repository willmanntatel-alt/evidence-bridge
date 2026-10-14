let report=null;
const byId=id=>document.getElementById(id);
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
function render(data){
  report=data;
  byId('status').textContent=data.status.replaceAll('_',' ');
  byId('status').className='status '+(data.status==='CONFLICT'?'conflict':data.status==='CONSISTENT_DEPLOYMENT_EVIDENCE'?'match':'');
  byId('execution').textContent=data.execution;
  byId('checks').replaceChildren();
  for(const check of data.checks){const li=document.createElement('li');const top=document.createElement('div');top.className='checktop';top.append(text('span',check.name));const badge=text('span',check.state.toUpperCase());badge.className='badge '+check.state;top.append(badge);li.append(top,text('small',check.detail));byId('checks').append(li);}
  const refs=[['Chain',data.target.chainId+' / Ethereum Sepolia'],['Contract',data.target.address],['Deployment transaction',data.source.transactionHash??'Not reported'],['Deployment block',data.source.deploymentBlock??'Not reported'],['Canonical block hash',data.chainEvidence?.block?.hash??'Unavailable'],['Finalized head',data.chainEvidence?.finalizedBlock??'Unavailable'],['Sourcify record',data.source.providerMatch],['Compiler',data.source.compiler??'Not reported'],['Record verified at',data.source.providerVerifiedAt??'Not reported'],['Evidence collected at',data.observedAt],['Declared source licenses',data.source.sources.map(x=>`${x.path}: ${x.declaredLicense??'unknown'}`).join('; ')||'Unknown']];
  byId('references').replaceChildren();for(const [key,value] of refs){byId('references').append(text('dt',key),text('dd',value));}
  const link=document.createElement('a');link.href=data.attribution.sourceUrl;link.target='_blank';link.rel='noreferrer';link.textContent='Open source-provider record';byId('references').append(text('dt','Independent source'),link);
  byId('limits').replaceChildren(...data.limitations.map(x=>text('li',x)));
  byId('fingerprint').textContent='A local fingerprint identifies the exported bytes; it is not an on-chain attestation.';
  byId('result').classList.remove('hidden');
}
byId('run').addEventListener('click',async()=>{
  byId('run').disabled=true;byId('error').textContent='';byId('status').textContent='Collecting public evidence…';byId('result').classList.add('hidden');report=null;
  try{const response=await fetch('/api/evidence?address='+encodeURIComponent(byId('address').value.trim()));const data=await response.json();if(!response.ok)throw new Error(data.error??'Provider unavailable');render(data);}
  catch(error){byId('status').textContent='UNAVAILABLE';byId('status').className='status';byId('error').textContent=error.message;}
  finally{byId('run').disabled=false;}
});
const bytes=()=>JSON.stringify(report,null,2)+'\n';
byId('digest').addEventListener('click',async()=>{if(!report)return;const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bytes()));byId('fingerprint').textContent='Local SHA-256: '+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')+' · Not anchored on-chain';});
