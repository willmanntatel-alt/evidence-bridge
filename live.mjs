import {normalizeSource, sourceUrl, validateTarget, reconcile} from './core.mjs';
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {...options, redirect: 'error', signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Public provider HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 1000000) throw new Error('Provider response exceeds the evidence limit');
  const text = await response.text();
  if (text.length > 1000000) throw new Error('Provider response exceeds the evidence limit');
  return JSON.parse(text);
}

async function rpc(method, params) {
  const result = await jsonRequest(RPC, {method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if (result.error) throw new Error(`Public RPC ${method} failed (${result.error.code})`);
  if (!Object.hasOwn(result,'result')) throw new Error('RPC response lacks a result');
  return result.result;
}

export async function collectDiagnostic(address) {
  const target = validateTarget('11155111', address);
  const id = await rpc('eth_chainId', []);
  if (BigInt(id).toString() !== target.chainId) throw new Error('RPC chain identity mismatch');
  const source = normalizeSource(await jsonRequest(sourceUrl(target)),target);
  let chainEvidence = null;
  if (source.transactionHash && source.deploymentBlock) {
    const finalized = await rpc('eth_getBlockByNumber',['finalized',false]);
    chainEvidence = {receipt:null,block:null,finalizedBlock:finalized ? BigInt(finalized.number).toString() : null};
    const receipt = await rpc('eth_getTransactionReceipt',[source.transactionHash]);
    if (receipt) {
      const block = await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
      chainEvidence = {
        receipt: {transactionHash: receipt.transactionHash, status: BigInt(receipt.status).toString(), contractAddress: receipt.contractAddress, blockNumber: BigInt(receipt.blockNumber).toString(), blockHash: receipt.blockHash},
        block: block ? {number: BigInt(block.number).toString(),hash:block.hash,timestamp:BigInt(block.timestamp).toString()} : null,
        finalizedBlock: finalized ? BigInt(finalized.number).toString() : null,
      };
    }
  }
  return {...reconcile(source,chainEvidence,new Date().toISOString()), execution:'Diagnostic public RPC + HTTP run; not a CRE CLI simulation',rpcSource:RPC};
}
