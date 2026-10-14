import {
  CronCapability, EVMClient, HTTPClient, Runner, handler, consensusIdenticalAggregation,
  type NodeRuntime, type Runtime, getNetwork, LAST_FINALIZED_BLOCK_NUMBER,
  hexToBytes, bytesToHex, protoBigIntToBigint, bigintToProtoBigInt,
} from '@chainlink/cre-sdk';
import {validateTarget, sourceUrl, normalizeSource, reconcile} from '../core.mjs';

type Config = {schedule: string; chainId: string; address: string};

const fetchSource = (runtime: NodeRuntime<Config>): string => {
  const target = validateTarget(runtime.config.chainId, runtime.config.address);
  const response = new HTTPClient().sendRequest(runtime, {url: sourceUrl(target), method: 'GET'}).result();
  if (response.statusCode !== 200) throw new Error(`Sourcify unavailable: HTTP ${response.statusCode}`);
  const raw = JSON.parse(new TextDecoder().decode(response.body));
  return JSON.stringify(normalizeSource(raw, target));
};

const onCron = (runtime: Runtime<Config>) => {
  validateTarget(runtime.config.chainId, runtime.config.address);
  const source = JSON.parse(runtime.runInNodeMode(fetchSource, consensusIdenticalAggregation<string>())().result());
  runtime.log(`Public source record: ${source.contractName ?? 'unknown'} / ${source.providerMatch}`);
  let chainEvidence = null;
  if (source.transactionHash && source.deploymentBlock) {
    const network = getNetwork({chainFamily: 'evm', chainSelectorName: 'ethereum-testnet-sepolia'});
    if (!network) throw new Error('Sepolia selector unavailable');
    const evm = new EVMClient(network.chainSelector.selector);
    const finalizedReply = evm.headerByNumber(runtime, {blockNumber: LAST_FINALIZED_BLOCK_NUMBER}).result();
    const finalized = finalizedReply.header;
    chainEvidence = {
      receipt: null as null | {transactionHash:string;status:string;contractAddress:string;blockNumber:string;blockHash:string},
      block: null as null | {number:string;hash:string;timestamp:string},
      finalizedBlock: finalized?.blockNumber ? protoBigIntToBigint(finalized.blockNumber).toString() : null,
    };
    const receiptReply = evm.getTransactionReceipt(runtime, {hash: hexToBytes(source.transactionHash)}).result();
    const receipt = receiptReply.receipt;
    if (receipt?.blockNumber) {
      const height = protoBigIntToBigint(receipt.blockNumber);
      const blockReply = evm.headerByNumber(runtime, {blockNumber: bigintToProtoBigInt(height)}).result();
      const block = blockReply.header;
      chainEvidence = {
        receipt: {
          transactionHash: bytesToHex(receipt.txHash), status: receipt.status.toString(),
          contractAddress: bytesToHex(receipt.contractAddress), blockNumber: height.toString(),
          blockHash: bytesToHex(receipt.blockHash),
        },
        block: block?.blockNumber ? {number: protoBigIntToBigint(block.blockNumber).toString(), hash: bytesToHex(block.hash), timestamp: block.timestamp.toString()} : null,
        finalizedBlock: chainEvidence.finalizedBlock,
      };
    }
  }
  const report = reconcile(source, chainEvidence, runtime.now().toISOString());
  runtime.log(`Evidence outcome: ${report.status}; ${report.checks.length} explicit checks`);
  return JSON.stringify({...report, execution: 'CRE CLI simulation / workflow result'});
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run((config: Config) => [handler(new CronCapability().trigger({schedule: config.schedule}), onCron)]);
}
