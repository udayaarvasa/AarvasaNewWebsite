/** Public, fixed-address reads only. No signer, account, write method or user-supplied RPC. */
import { createPublicClient, decodeEventLog, http, parseAbi, type Hex } from "viem";

export const TESTNET = {
  chainId: 84532,
  units: "0xa71018392a3F0cB140e1E6534ffD111F8116775B",
  registry: "0x70Da2fc59AC844Ef0b4CE4F773CAa47Fd1D68fd2",
  investorA: "0x5B81017da793e8dC6045D207E32e2C58eAB70EC7",
  transfer: "0x7baa4f1db23e1c13aaabb293bd3093b74c1c92f04544b34e11b1955a96a41481",
  anchor: "0xf57dcd602289bbdebd7d7070cf61bd0542c80aeb7ab79fec0adc4be9b1abe502",
  digest: "0x24bb7bd0fa0300b15a6040a4c68b03eee401b1e579822b99c10080cc29d8a4b8",
} as const;
const unitsAbi = parseAbi([
  "function totalSupply() view returns (uint256)", "function cap() view returns (uint256)",
  "function paused() view returns (bool)", "function balanceOf(address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const registryAbi = parseAbi([
  "function lookup(bytes32) view returns (bool exists, bytes32 recordIdHash, address anchorer, uint64 timestamp, uint64 blockNumber)",
  "event DocumentAnchored(bytes32 indexed digest, bytes32 indexed recordIdHash, address indexed anchorer, uint64 timestamp)",
]);
type Receipt = { status: string; to: string | null; blockNumber: bigint; logs: readonly { address: string; data: Hex; topics: readonly Hex[] }[] };
export function inspectTransfer(receipt: Receipt) {
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== TESTNET.units.toLowerCase()) throw new Error("Transfer receipt did not match the deployed contract.");
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== TESTNET.units.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: unitsAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (decoded.eventName === "Transfer" && decoded.args.from.toLowerCase() === TESTNET.investorA.toLowerCase() && decoded.args.value === BigInt(50))
        return { from: decoded.args.from, to: decoded.args.to, units: decoded.args.value.toString(), block: receipt.blockNumber.toString() };
    } catch { /* Only the expected decoded event is evidence. */ }
  }
  throw new Error("Expected transfer event was not found.");
}
export function inspectAnchor(receipt: Receipt, recordHash: Hex) {
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== TESTNET.registry.toLowerCase()) throw new Error("Anchor receipt did not match the registry.");
  return receipt.logs.some(log => {
    if (log.address.toLowerCase() !== TESTNET.registry.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({abi:registryAbi,data:log.data,topics:log.topics as [Hex,...Hex[]]});
      return decoded.eventName === "DocumentAnchored" && decoded.args.digest === TESTNET.digest && decoded.args.recordIdHash === recordHash;
    } catch { return false; }
  });
}
export async function readTestnetProof() {
  const client = createPublicClient({transport:http("https://sepolia.base.org",{timeout:8000,retryCount:0})});
  if (await client.getChainId() !== TESTNET.chainId) throw new Error("Unexpected network.");
  const latest = await client.getBlockNumber();
  const blockNumber = latest > BigInt(3) ? latest - BigInt(3) : latest;
  const [unitsCode, registryCode, transferReceipt, anchorReceipt] = await Promise.all([
    client.getCode({address:TESTNET.units,blockNumber}), client.getCode({address:TESTNET.registry,blockNumber}),
    client.getTransactionReceipt({hash:TESTNET.transfer}), client.getTransactionReceipt({hash:TESTNET.anchor}),
  ]);
  if (!unitsCode || unitsCode === "0x" || !registryCode || registryCode === "0x") throw new Error("Contract bytecode was not found.");
  if (transferReceipt.blockNumber > blockNumber || anchorReceipt.blockNumber > blockNumber) throw new Error("Receipts have not reached the confirmation depth.");
  const transfer = inspectTransfer(transferReceipt);
  const [supply, cap, paused, a, b, anchor] = await Promise.all([
    client.readContract({address:TESTNET.units,abi:unitsAbi,functionName:"totalSupply",blockNumber}),
    client.readContract({address:TESTNET.units,abi:unitsAbi,functionName:"cap",blockNumber}),
    client.readContract({address:TESTNET.units,abi:unitsAbi,functionName:"paused",blockNumber}),
    client.readContract({address:TESTNET.units,abi:unitsAbi,functionName:"balanceOf",args:[TESTNET.investorA],blockNumber}),
    client.readContract({address:TESTNET.units,abi:unitsAbi,functionName:"balanceOf",args:[transfer.to],blockNumber}),
    client.readContract({address:TESTNET.registry,abi:registryAbi,functionName:"lookup",args:[TESTNET.digest],blockNumber}),
  ]);
  if (!anchor[0] || !inspectAnchor(anchorReceipt,anchor[1]) || anchor[4] !== anchorReceipt.blockNumber) throw new Error("The registry lookup and anchor event did not agree.");
  return {
    network:"Base Sepolia",chainId:TESTNET.chainId,checkedAt:new Date().toISOString(),block:blockNumber.toString(),
    units:{address:TESTNET.units,supply:supply.toString(),cap:cap.toString(),paused,investors:[{label:"Investor A",address:TESTNET.investorA,balance:a.toString()},{label:"Investor B",address:transfer.to,balance:b.toString()}]},
    transfer:{...transfer,hash:TESTNET.transfer,status:"success"},
    document:{address:TESTNET.registry,digest:TESTNET.digest.slice(2),hash:TESTNET.anchor,block:anchor[4].toString(),status:"success",timestamp:new Date(Number(anchor[3])*1000).toISOString()},
  };
}
export type TestnetProof = Awaited<ReturnType<typeof readTestnetProof>>;
