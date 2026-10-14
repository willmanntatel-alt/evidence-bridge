export const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export const HASH = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const lower = value => typeof value === 'string' ? value.toLowerCase() : '';

export function validateTarget(chainId, address) {
  if (String(chainId) !== '11155111') throw new Error('This pilot supports Sepolia only.');
  if (!ADDRESS.test(address)) throw new Error('Enter a 20-byte Ethereum address.');
  return {chainId: String(chainId), address: lower(address)};
}

export function sourceUrl(target) {
  validateTarget(target.chainId, target.address);
  return `https://sourcify.dev/server/v2/contract/${target.chainId}/${target.address}?fields=compilation,deployment,metadata,verifiedAt`;
}

export function normalizeSource(raw, target) {
  validateTarget(target.chainId, target.address);
  if (!raw || String(raw.chainId) !== String(target.chainId) || lower(raw.address) !== lower(target.address)) {
    throw new Error('Provider response does not identify the requested chain and address.');
  }
  const tx = raw.deployment?.transactionHash;
  const block = raw.deployment?.blockNumber;
  const sources = Object.entries(raw.metadata?.sources ?? {}).map(([path, source]) => ({
    path, declaredLicense: typeof source.license === 'string' ? source.license : null,
    sourceKeccak256: HASH.test(source.keccak256 ?? '') ? lower(source.keccak256) : null,
  }));
  return {
    address: lower(raw.address), chainId: String(raw.chainId),
    transactionHash: HASH.test(tx ?? '') ? lower(tx) : null,
    deploymentBlock: DECIMAL.test(String(block ?? '')) ? String(block) : null,
    providerMatch: typeof raw.match === 'string' ? raw.match : 'not-reported',
    runtimeMatch: typeof raw.runtimeMatch === 'string' ? raw.runtimeMatch : 'not-reported',
    creationMatch: typeof raw.creationMatch === 'string' ? raw.creationMatch : 'not-reported',
    providerVerifiedAt: typeof raw.verifiedAt === 'string' ? raw.verifiedAt : null,
    compiler: raw.compilation?.compilerVersion ?? null,
    contractName: raw.compilation?.name ?? null,
    sources,
  };
}

export function reconcile(source, chainEvidence, observedAt) {
  const checks = [];
  const add = (name, state, detail) => checks.push({name, state, detail});
  const receipt = chainEvidence?.receipt;
  if (!source.transactionHash || !source.deploymentBlock) {
    add('Deployment reference', 'unknown', 'Source provider did not report both a deployment transaction and block.');
  } else if (!receipt) {
    add('Deployment receipt', 'unknown', 'The blockchain provider did not return a receipt.');
  } else {
    add('Transaction identity', lower(receipt.transactionHash) === source.transactionHash ? 'match' : 'conflict', 'Compare requested deployment transaction with the returned receipt.');
    add('Transaction outcome', receipt.status === '1' ? 'match' : receipt.status === '0' ? 'conflict' : 'unknown', 'Success is a transaction execution status, not an audit conclusion.');
    add('Deployment block', receipt.blockNumber === source.deploymentBlock ? 'match' : DECIMAL.test(receipt.blockNumber ?? '') ? 'conflict' : 'unknown', 'Compare source record and receipt block numbers without rounding.');
    if (!ADDRESS.test(receipt.contractAddress ?? '') || /^0x0{40}$/i.test(receipt.contractAddress)) {
      add('Direct creation address', 'unknown', 'No direct creation address: factory deployments need a separate trace/log review.');
    } else {
      add('Direct creation address', lower(receipt.contractAddress) === source.address ? 'match' : 'conflict', 'Compare the receipt creation address with the requested contract.');
    }
    const canonical = chainEvidence.block;
    if (!canonical || !HASH.test(canonical.hash ?? '') || !HASH.test(receipt.blockHash ?? '')) {
      add('Canonical block', 'unknown', 'Block-header evidence is unavailable.');
    } else {
      add('Canonical block', lower(canonical.hash) === lower(receipt.blockHash) && canonical.number === receipt.blockNumber ? 'match' : 'conflict', 'Check that the receipt belongs to the canonical block fetched independently.');
    }
    const finalized = chainEvidence.finalizedBlock;
    add('Finality', DECIMAL.test(finalized ?? '') && DECIMAL.test(receipt.blockNumber ?? '')
      ? BigInt(finalized) >= BigInt(receipt.blockNumber) ? 'match' : 'pending'
      : 'unknown', 'Compare deployment height with the provider-reported finalized head.');
  }
  const status = checks.some(x => x.state === 'conflict') ? 'CONFLICT'
    : checks.some(x => x.state === 'pending') ? 'PENDING_FINALITY'
    : checks.some(x => x.state === 'unknown') ? 'INCOMPLETE'
    : 'CONSISTENT_DEPLOYMENT_EVIDENCE';
  return {
    schema: 'evidence-bridge/v1', status, observedAt, target: {chainId: source.chainId, address: source.address},
    source, chainEvidence: chainEvidence ?? null, checks,
    attribution: {sourceProvider: 'Sourcify API v2', sourceUrl: sourceUrl(source), chain: 'Ethereum Sepolia'},
    limitations: [
      'Source verification status is reported by Sourcify; this tool does not recompile or compare current bytecode.',
      'A deployment receipt does not prove present proxy implementation, contract safety, ownership, or legal enforceability.',
      'License labels are metadata declarations; they do not establish licence compliance or permission to reuse code.',
      'Provider-reported finality and canonicality are observations, not an independent Ethereum consensus proof.',
      'Read-only evidence for human review. No signing, payments, legal conclusions, or financial recommendations.',
    ],
  };
}
