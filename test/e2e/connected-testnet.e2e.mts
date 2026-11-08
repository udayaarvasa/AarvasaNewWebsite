/** Run against a NEW isolated Hardhat node; never a public chain.
 * AARVASA_CONTRACT_TEST_ROOT=/path/to/contracts node --experimental-strip-types test/e2e/connected-testnet.e2e.mts
 * Start that repo's hardhat node on 127.0.0.1:8556 first. No keys or production DB are used.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Address } from "viem";
import { hardhat } from "viem/chains";
import { createChainGateway, wholeUnits, type ChainAction, type TransactionRecord, type WalletProvider } from "../../src/lib/connected-testnet.ts";
const rpc="http://127.0.0.1:8556";
const root=process.env.AARVASA_CONTRACT_TEST_ROOT;
assert.ok(root,"AARVASA_CONTRACT_TEST_ROOT is required");
let sequence=0;
async function request(method:string,params:readonly unknown[]=[]){
  const response=await fetch(rpc,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:++sequence,method,params})});
  const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});return result.result;
}
assert.equal(Number(await request("eth_chainId")),31337,"Refusing any network but the isolated local chain");

const accounts=await request("eth_accounts") as Address[];
const [admin,issuer,controller,a,b,c,anchorer]=accounts;
const client=createPublicClient({transport:http(rpc),pollingInterval:20,cacheTime:0});
const wallet=createWalletClient({account:admin,chain:hardhat,transport:http(rpc)});
async function deploy(name:string,args:unknown[]){
  const artifact=JSON.parse(await readFile(path.join(root!,`artifacts/contracts/${name}.sol/${name}.json`),"utf8"));
  const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode,args,chain:hardhat});
  return (await client.waitForTransactionReceipt({hash})).contractAddress!;
}
const units=await deploy("AarvasaPrototypeUnits",["Dashboard test units","TEST",BigInt(10000),keccak256(toBytes("dashboard-test")),admin,issuer,controller,3600]);
const registry=await deploy("AarvasaDocumentRegistry",[admin,anchorer]);
const gateway=createChainGateway(client,{chainId:31337,units,registry});
let sent=0;
const provider=(account:Address):WalletProvider=>({request:async({method,params})=>{
  if(method==="eth_accounts")return [account];
  if(method==="eth_sendTransaction")sent++;
  return request(method,params);
}});
const records:TransactionRecord[]=[];
async function submit(action:ChainAction,account:Address){
  const {intent}=await gateway.prepare(action,account,`test-${records.length}`);
  const hash=await gateway.requestSignature(provider(account),intent);
  await request("hardhat_mine",["0x3"]);
  const record:TransactionRecord={...intent,hash,status:"pending"};
  const receipt=await gateway.receipt(record);assert.equal(receipt.status,"confirmed");records.push({...record,...receipt});return record;
}
const ref=(s:string)=>keccak256(toBytes(s));
const watch=[{label:"A",address:a},{label:"B",address:b},{label:"C",address:c}];
await assert.rejects(gateway.prepare({kind:"issue",recipient:a,amount:"10",reference:ref("bad")},controller,"bad-role"),/issuer role/);
assert.equal(sent,0,"Unauthorized wallet must not open a send request");
for(const address of [a,b])await submit({kind:"allowlist",recipient:address,allowed:true},controller);
await submit({kind:"issue",recipient:a,amount:"1000",reference:ref("initial-issue")},issuer);
let state=await gateway.snapshot(watch,a);assert.deepEqual(state.investors.map(i=>i.balance),["1000","0","0"]);
const initialSent=sent;
await assert.rejects(gateway.prepare({kind:"issue",recipient:a,amount:"1",reference:ref("initial-issue")},issuer,"duplicate"));
await assert.rejects(gateway.prepare({kind:"issue",recipient:a,amount:"9001",reference:ref("overcap")},issuer,"overcap"));
await assert.rejects(gateway.prepare({kind:"transfer",recipient:c,amount:"1"},a,"not-allowlisted"));
assert.equal(sent,initialSent,"Refused preflight must not submit a transaction");
await submit({kind:"transfer",recipient:b,amount:"250"},a);
await submit({kind:"pause",paused:true},controller);
await assert.rejects(gateway.prepare({kind:"transfer",recipient:b,amount:"1"},a,"paused"));
await assert.rejects(gateway.prepare({kind:"issue",recipient:b,amount:"1",reference:ref("paused")},issuer,"paused-issue"));
await submit({kind:"pause",paused:false},controller);
await submit({kind:"transfer",recipient:b,amount:"50"},a);
state=await gateway.snapshot(watch,a);assert.deepEqual(state.investors.map(i=>i.balance),["700","300","0"]);assert.equal(state.supply,"1000");
const digest=ref("synthetic document bytes"),record=ref("synthetic document record");
await submit({kind:"anchor",digest,record},anchorer);
const anchored=await gateway.lookup(digest);assert.equal(anchored[0],true);assert.equal(anchored[1],record);
await assert.rejects(gateway.prepare({kind:"anchor",digest,record},anchorer,"duplicate-anchor"));
const prepared=await gateway.prepare({kind:"transfer",recipient:b,amount:"1"},a,"wallet-guard");
await assert.rejects(gateway.requestSignature({request:async({method})=>method==="eth_chainId"?"0x1":[a]},prepared.intent),/Base Sepolia/);
await assert.rejects(gateway.requestSignature(provider(b),prepared.intent),/account changed/);
for(const amount of ["0","-1","1.5","1e3"])assert.throws(()=>wholeUnits(amount));
const original=records[2];const beforeRetry=sent;
await gateway.receipt(original);await gateway.receipt(original);assert.equal(sent,beforeRetry,"Receipt checks never resend a transaction");
await assert.rejects(gateway.receipt({...original,data:prepared.intent.data}),/does not match/);
const events=await gateway.activity();assert.ok(events.events.some(e=>e.name==="UnitsIssued"));assert.ok(events.events.some(e=>e.name==="DocumentAnchored"));
console.log(JSON.stringify({passed:true,chain:31337,confirmedTransactions:records.length,balances:state.investors.map(i=>i.balance),supply:state.supply,anchorVerified:true,guards:["role","cap","allowlist","pause","duplicate issuance","duplicate anchor","wrong chain","wrong account","receipt mismatch","no resend on receipt retry"]},null,2));
