import { createPublicClient, decodeEventLog, encodeFunctionData, getAddress, http, isAddress, keccak256, parseAbi, toBytes, type Address, type Hex } from "viem";

export const CONNECTED = {
  chainId: 84532, rpc: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org",
  units: "0xa71018392a3F0cB140e1E6534ffD111F8116775B" as Address,
  registry: "0x70Da2fc59AC844Ef0b4CE4F773CAa47Fd1D68fd2" as Address,
  investors: [
    {label:"Investor A",address:"0x5B81017da793e8dC6045D207E32e2C58eAB70EC7" as Address},
    {label:"Investor B",address:"0x1AdCD45D8FF8aA19689b49e799A03FbD194809b9" as Address},
  ],
};
export const UNITS = parseAbi([
  "function totalSupply() view returns (uint256)", "function cap() view returns (uint256)",
  "function paused() view returns (bool)", "function balanceOf(address) view returns (uint256)",
  "function isAllowlisted(address) view returns (bool)", "function hasRole(bytes32,address) view returns (bool)",
  "function roleHolder(bytes32) view returns (address)",
  "function issue(address,uint256,bytes32)", "function issuanceUsed(bytes32) view returns (bool)",
  "function transfer(address,uint256) returns (bool)", "function setAllowlisted(address,bool)", "function pause()", "function unpause()",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
  "event UnitsIssued(address indexed to,uint256 amount,bytes32 indexed issuanceRef)",
  "event AllowlistUpdated(address indexed account,bool allowed)",
  "event Paused(address account)", "event Unpaused(address account)",
  "error NotAllowlisted(address account)", "error EnforcedPause()", "error ExpectedPause()",
  "error ERC20ExceededCap(uint256 increasedSupply,uint256 cap)",
  "error ERC20InsufficientBalance(address sender,uint256 balance,uint256 needed)",
  "error AccessControlUnauthorizedAccount(address account,bytes32 neededRole)",
  "error IssuanceAlreadyRecorded(bytes32 issuanceRef)", "error WalletAlreadyPrivileged(address account)",
]);
export const REGISTRY = parseAbi([
  "function hasRole(bytes32,address) view returns (bool)",
  "function lookup(bytes32) view returns (bool exists,bytes32 recordIdHash,address anchorer,uint64 timestamp,uint64 blockNumber)",
  "function anchor(bytes32,bytes32)",
  "event DocumentAnchored(bytes32 indexed digest,bytes32 indexed recordIdHash,address indexed anchorer,uint64 timestamp)",
  "error DigestAlreadyAnchored(bytes32 digest)", "error RecordAlreadyAnchored(bytes32 recordIdHash)",
  "error AccessControlUnauthorizedAccount(address account,bytes32 neededRole)",
]);
export const ROLES = {issuer:keccak256(toBytes("ISSUER_ROLE")),controller:keccak256(toBytes("TRANSFER_CONTROLLER_ROLE")),anchorer:keccak256(toBytes("ANCHORER_ROLE"))};
export type WalletProvider = {
  request(input:{method:string;params?:readonly unknown[]}):Promise<unknown>;
  on?(event:string,callback:(...args:unknown[])=>void):void;
  removeListener?(event:string,callback:(...args:unknown[])=>void):void;
};
export type ChainConfig = Pick<typeof CONNECTED,"chainId"|"units"|"registry">;
export type ChainAction =
  | {kind:"issue";recipient:Address;amount:string;reference:Hex}
  | {kind:"transfer";recipient:Address;amount:string}
  | {kind:"allowlist";recipient:Address;allowed:boolean}
  | {kind:"pause";paused:boolean}
  | {kind:"anchor";digest:Hex;record:Hex};
export type Intent = {id:string;createdAt:number;label:string;from:Address;to:Address;data:Hex;chainId:number};
export type TransactionRecord = Intent & {status:"awaiting-wallet"|"unknown"|"pending"|"confirmed"|"reverted"|"rejected"|"cancelled";hash?:Hex;block?:string;message?:string};
const address=(value:string)=>{if(!isAddress(value))throw new Error("Enter a valid wallet address.");return getAddress(value);};
const bytes32=(value:string):Hex=>{if(!/^0x[0-9a-f]{64}$/i.test(value)||/^0x0{64}$/.test(value))throw new Error("A non-zero 32-byte reference is required.");return value as Hex;};
export const wholeUnits=(value:string)=>{if(!/^[1-9][0-9]{0,76}$/.test(value))throw new Error("Enter a positive whole number of test units.");const n=BigInt(value);if(n>BigInt(2)**BigInt(256)-BigInt(1))throw new Error("Unit amount is too large.");return n;};
export const sameAddress=(a:string|undefined|null,b:string|undefined|null)=>!!a&&!!b&&a.toLowerCase()===b.toLowerCase();
export function assertTestChain(chainId:number) {if(chainId!==84532&&chainId!==31337)throw new Error("Only Base Sepolia or an isolated local test chain is supported.");}
export function buildIntent(action:ChainAction,from:Address,id:string,config:ChainConfig=CONNECTED):Intent {
  assertTestChain(config.chainId);address(from);
  let to=config.units;let data:Hex;let label:string;
  switch(action.kind){
    case "issue":data=encodeFunctionData({abi:UNITS,functionName:"issue",args:[address(action.recipient),wholeUnits(action.amount),bytes32(action.reference)]});label=`Issue ${action.amount} test units`;break;
    case "transfer":if(sameAddress(from,action.recipient))throw new Error("Choose a different receiving wallet.");data=encodeFunctionData({abi:UNITS,functionName:"transfer",args:[address(action.recipient),wholeUnits(action.amount)]});label=`Transfer ${action.amount} test units`;break;
    case "allowlist":data=encodeFunctionData({abi:UNITS,functionName:"setAllowlisted",args:[address(action.recipient),action.allowed]});label=action.allowed?"Allowlist wallet":"Remove wallet from allowlist";break;
    case "pause":data=encodeFunctionData({abi:UNITS,functionName:action.paused?"pause":"unpause"});label=action.paused?"Pause class":"Resume class";break;
    case "anchor":to=config.registry;data=encodeFunctionData({abi:REGISTRY,functionName:"anchor",args:[bytes32(action.digest),bytes32(action.record)]});label="Anchor synthetic document";break;
  }
  return {id,createdAt:Date.now(),label,from,to,data,chainId:config.chainId};
}
export const publicTestnet=()=>createPublicClient({transport:http(CONNECTED.rpc,{timeout:12000,retryCount:1}),pollingInterval:2000,cacheTime:0});
type Reader=ReturnType<typeof publicTestnet>;
export function createChainGateway(client:Reader,config:ChainConfig=CONNECTED){
  assertTestChain(config.chainId);
  const assertChain=async()=>{if(await client.getChainId()!==config.chainId)throw new Error("The RPC is on the wrong network. Nothing was sent.");};
  const walletIdentity=async(provider:WalletProvider,expected?:Address)=>{
    const chain=await provider.request({method:"eth_chainId"});
    if(typeof chain!=="string"||Number(chain)!==config.chainId)throw new Error("Select Base Sepolia in your wallet. Nothing was sent.");
    const accounts=await provider.request({method:"eth_accounts"});
    if(!Array.isArray(accounts)||typeof accounts[0]!=="string"||!isAddress(accounts[0]))throw new Error("Connect your wallet first.");
    const account=getAddress(accounts[0]);
    if(expected&&!sameAddress(account,expected))throw new Error("The wallet account changed. Review the action again.");
    return account;
  };
  return {
    async snapshot(watch:readonly {label:string;address:Address}[],account?:Address){
      await assertChain();const blockNumber=await client.getBlockNumber({cacheTime:0});
      const read={address:config.units,abi:UNITS,blockNumber};
      const wallets=account&&!watch.some(i=>sameAddress(i.address,account))?[...watch,{label:"Connected wallet",address:account}]:watch;
      const [supply,cap,paused,issuer,controller,anchorer,gas,investors,issuerWallet,controllerWallet]=await Promise.all([
        client.readContract({...read,functionName:"totalSupply"}),client.readContract({...read,functionName:"cap"}),client.readContract({...read,functionName:"paused"}),
        account?client.readContract({...read,functionName:"hasRole",args:[ROLES.issuer,account]}):false,
        account?client.readContract({...read,functionName:"hasRole",args:[ROLES.controller,account]}):false,
        account?client.readContract({address:config.registry,abi:REGISTRY,functionName:"hasRole",args:[ROLES.anchorer,account],blockNumber}):false,
        account?client.getBalance({address:account,blockNumber}):BigInt(0),
        Promise.all(wallets.map(async investor=>({...investor,balance:(await client.readContract({...read,functionName:"balanceOf",args:[investor.address]})).toString(),allowlisted:await client.readContract({...read,functionName:"isAllowlisted",args:[investor.address]})}))),
        client.readContract({...read,functionName:"roleHolder",args:[ROLES.issuer]}),client.readContract({...read,functionName:"roleHolder",args:[ROLES.controller]}),
      ]);
      return {block:blockNumber.toString(),checkedAt:Date.now(),supply:supply.toString(),cap:cap.toString(),paused,roles:{issuer,controller,anchorer},roleWallets:{issuer:issuerWallet,controller:controllerWallet},gas:gas.toString(),investors};
    },
    async prepare(action:ChainAction,account:Address,id:string){
      await assertChain();
      const intent=buildIntent(action,account,id,config);
      const code=await client.getCode({address:intent.to});if(!code||code==="0x")throw new Error("The deployed contract was not found.");
      if(action.kind!=="transfer"){
        const role=action.kind==="anchor"?ROLES.anchorer:action.kind==="issue"?ROLES.issuer:ROLES.controller;
        const allowed=await client.readContract({address:intent.to,abi:action.kind==="anchor"?REGISTRY:UNITS,functionName:"hasRole",args:[role,account]});
        if(!allowed)throw new Error(`This wallet does not hold the ${action.kind==="anchor"?"anchorer":action.kind==="issue"?"issuer":"controller"} role.`);
      }
      // A real eth_call of the exact transaction: rule violations stop before the wallet prompt.
      await client.call({account,to:intent.to,data:intent.data,value:BigInt(0)});
      const gas=await client.estimateGas({account,to:intent.to,data:intent.data,value:BigInt(0)});
      return {intent,gas:gas.toString()};
    },
    async requestSignature(provider:WalletProvider,intent:Intent){
      if(intent.chainId!==config.chainId||(!sameAddress(intent.to,config.units)&&!sameAddress(intent.to,config.registry)))throw new Error("Unsupported transaction destination.");
      await assertChain();await walletIdentity(provider,intent.from);
      // The chain id is included in the wallet request. No private key is read or stored.
      const hash=await provider.request({method:"eth_sendTransaction",params:[{from:intent.from,to:intent.to,data:intent.data,value:"0x0",chainId:`0x${config.chainId.toString(16)}`}]});
      if(typeof hash!=="string"||!/^0x[0-9a-f]{64}$/i.test(hash))throw new Error("The wallet did not return a transaction hash. Check wallet activity before retrying.");
      return hash as Hex;
    },
    async receipt(record:TransactionRecord,onReplacement?:(hash:Hex,cancelled:boolean)=>void){
      if(!record.hash)throw new Error("No transaction hash is available.");
      await assertChain();let changed=false;
      const receipt=await client.waitForTransactionReceipt({hash:record.hash,confirmations:3,timeout:60000,onReplaced:({transaction})=>{
        changed=!sameAddress(transaction.from,record.from)||!sameAddress(transaction.to,record.to)||transaction.input!==record.data||transaction.value!==BigInt(0);
        onReplacement?.(transaction.hash,changed);
      }});
      if(changed)return {status:"cancelled" as const,hash:receipt.transactionHash,block:receipt.blockNumber.toString()};
      const tx=await client.getTransaction({hash:receipt.transactionHash});
      if(!sameAddress(tx.from,record.from)||!sameAddress(tx.to,record.to)||tx.input!==record.data||tx.value!==BigInt(0)||tx.chainId!==config.chainId)throw new Error("The receipt does not match this requested action.");
      return {status:receipt.status==="success"?"confirmed" as const:"reverted" as const,hash:receipt.transactionHash,block:receipt.blockNumber.toString()};
    },
    async lookup(digest:Hex){await assertChain();return client.readContract({address:config.registry,abi:REGISTRY,functionName:"lookup",args:[bytes32(digest)]});},
    async activity(){
      await assertChain();const latest=await client.getBlockNumber({cacheTime:0});const start=latest>BigInt(420)?latest-BigInt(420):BigInt(0);const events=[];
      for(let from=start;from<=latest;from+=BigInt(140)){
        const to=from+BigInt(139)<latest?from+BigInt(139):latest;
        const logs=await client.getLogs({address:[config.units,config.registry],fromBlock:from,toBlock:to});
        for(const log of logs){try{
          const decoded=decodeEventLog({abi:sameAddress(log.address,config.registry)?REGISTRY:UNITS,data:log.data,topics:log.topics});
          events.push({name:decoded.eventName,hash:log.transactionHash,block:log.blockNumber?.toString(),detail:Object.entries(decoded.args??{}).map(([k,v])=>`${k}: ${String(v)}`).join(" · ")});
        }catch{/* Unknown events are not presented as decoded evidence. */}}
      }
      return {from:start.toString(),to:latest.toString(),events:events.reverse()};
    },
    walletIdentity,
  };
}
export type LiveSnapshot=Awaited<ReturnType<ReturnType<typeof createChainGateway>["snapshot"]>>;
export type LiveActivity=Awaited<ReturnType<ReturnType<typeof createChainGateway>["activity"]>>;
export function walletRejected(error:unknown):boolean {
  if(!error||typeof error!=="object")return false;
  const e=error as {code?:unknown;cause?:unknown};return e.code===4001||(!!e.cause&&e.cause!==error&&walletRejected(e.cause));
}
export function transactionError(error:unknown):string {
  if(walletRejected(error))return "You rejected the request in your wallet. No transaction was submitted by this request.";
  const e=error as {shortMessage?:string;message?:string};return (e?.shortMessage||e?.message||"The request could not be completed.").slice(0,400);
}
export function restoreJournal(raw:string|null):TransactionRecord[]{
  try{
    const parsed=JSON.parse(raw??"[]");if(!Array.isArray(parsed))return [];
    return parsed.filter((r):r is TransactionRecord=>r&&r.chainId===84532&&isAddress(r.from)&&[CONNECTED.units.toLowerCase(),CONNECTED.registry.toLowerCase()].includes(String(r.to).toLowerCase())&&/^0x[0-9a-f]{8,2048}$/i.test(r.data)&&typeof r.id==="string"&&typeof r.label==="string"&&typeof r.createdAt==="number"&&["awaiting-wallet","unknown","pending","confirmed","reverted","rejected","cancelled"].includes(r.status)&&(!r.hash||/^0x[0-9a-f]{64}$/i.test(r.hash))).slice(0,30).map(r=>r.status==="awaiting-wallet"?{...r,status:"unknown",message:"The page closed during a wallet request. Check wallet activity; nothing will be resent automatically."}:r);
  }catch{return [];}
}
