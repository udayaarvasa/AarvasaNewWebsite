import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, type Address, type Hex } from 'viem';
import { CONNECTED, UNITS, buildIntent, createChainGateway, publicTestnet, restoreJournal, wholeUnits, walletRejected, type TransactionRecord } from '../src/lib/connected-testnet.ts';
const a=CONNECTED.investors[0].address,b=CONNECTED.investors[1].address;
const ref=`0x${'a'.repeat(64)}` as Hex;
const hash=`0x${'b'.repeat(64)}` as Hex;
const intent=buildIntent({kind:'issue',recipient:a,amount:'10',reference:ref},a,'request-1');
const fake=(methods:Record<string,unknown>)=>methods as unknown as ReturnType<typeof publicTestnet>;

test('transaction builder restricts network, positive whole units and destinations',()=>{
  const decoded=decodeFunctionData({abi:UNITS,data:intent.data});
  assert.equal(decoded.functionName,'issue');assert.equal(decoded.args?.[1],BigInt(10));
  assert.equal(intent.to,CONNECTED.units);assert.equal(intent.chainId,84532);
  assert.throws(()=>buildIntent({kind:'transfer',recipient:b,amount:'1'},a,'bad',{...CONNECTED,chainId:8453}));
  for(const value of ['0','-1','1.5','1e3','NaN',' 1','01'])assert.throws(()=>wholeUnits(value));
  assert.throws(()=>buildIntent({kind:'transfer',recipient:a,amount:'1'},a,'same'));
  assert.throws(()=>buildIntent({kind:'issue',recipient:a,amount:'1',reference:'0x0' as Hex},a,'bad-reference'));
});

test('mainnet or changed wallet identity cannot reach eth_sendTransaction',async()=>{
  const gateway=createChainGateway(fake({getChainId:async()=>84532}));let sends=0;
  for(const [chain,account]of [['0x1',a],['0x14a34',b]]){
    await assert.rejects(gateway.requestSignature({request:async({method})=>{if(method==='eth_sendTransaction')sends++;return method==='eth_chainId'?chain:[account];}},intent));
  }
  assert.equal(sends,0);
});

test('unprivileged wallets fail preflight without any signing or send path',async()=>{
  let calls=0;
  const gateway=createChainGateway(fake({getChainId:async()=>84532,getCode:async()=>'0x1234',readContract:async()=>false,call:async()=>{calls++;}}));
  await assert.rejects(gateway.prepare({kind:'issue',recipient:a,amount:'10',reference:ref},a,'bad-role'),/issuer role/);
  assert.equal(calls,0);
});

test('receipt success requires exact sender, destination, calldata, zero value and chain',async()=>{
  const record:TransactionRecord={...intent,hash,status:'pending'};
  const transaction={from:a,to:intent.to,input:intent.data,value:BigInt(0),chainId:84532};
  const receipt={status:'success',transactionHash:hash,blockNumber:BigInt(123)};
  const gateway=(tx:unknown)=>createChainGateway(fake({getChainId:async()=>84532,waitForTransactionReceipt:async()=>receipt,getTransaction:async()=>tx}));
  assert.equal((await gateway(transaction).receipt(record)).status,'confirmed');
  for(const changed of [{...transaction,from:b},{...transaction,to:b},{...transaction,input:'0x1234'},{...transaction,value:BigInt(1)},{...transaction,chainId:1}])await assert.rejects(gateway(changed).receipt(record),/does not match/);
});

test('repricing tracks a replacement; a different replacement is cancelled, not confirmed',async()=>{
  const record:TransactionRecord={...intent,hash,status:'pending'};
  const replacement=`0x${'c'.repeat(64)}` as Hex;
  const tx={from:a,to:intent.to,input:intent.data,value:BigInt(0),chainId:84532,hash:replacement};
  for(const cancelled of [false,true]){
    let replacedHash:Hex|undefined;
    const gateway=createChainGateway(fake({getChainId:async()=>84532,waitForTransactionReceipt:async({onReplaced}:{onReplaced:(v:unknown)=>void})=>{onReplaced({transaction:cancelled?{...tx,input:'0x'}:tx});return {status:'success',transactionHash:replacement,blockNumber:BigInt(123)};},getTransaction:async()=>tx}));
    const result=await gateway.receipt(record,(h,c)=>{replacedHash=h;assert.equal(c,cancelled);});
    assert.equal(replacedHash,replacement);assert.equal(result.status,cancelled?'cancelled':'confirmed');
  }
});

test('timeouts never cause a second send; wallet rejections remain distinguishable from unknown errors',async()=>{
  let sends=0;const gateway=createChainGateway(fake({getChainId:async()=>84532,waitForTransactionReceipt:async()=>{throw new Error('RPC timeout');}}));
  const sent=await gateway.requestSignature({request:async({method})=>{if(method==='eth_sendTransaction'){sends++;return hash;}return method==='eth_chainId'?'0x14a34':[a];}},intent);
  const record:TransactionRecord={...intent,hash:sent,status:'pending'};
  await assert.rejects(gateway.receipt(record));await assert.rejects(gateway.receipt(record));assert.equal(sends,1);
  assert.equal(walletRejected({code:4001}),true);assert.equal(walletRejected({cause:{code:4001}}),true);assert.equal(walletRejected(new Error('network timeout')),false);
});

test('reload restores uncertain requests without automatically resending and rejects foreign journal records',()=>{
  const restored=restoreJournal(JSON.stringify([{...intent,status:'awaiting-wallet'},{...intent,id:'pending',status:'pending',hash}]));
  assert.equal(restored[0].status,'unknown');assert.equal(restored[1].status,'pending');assert.equal(restored[1].hash,hash);
  assert.deepEqual(restoreJournal(JSON.stringify([{...intent,to:b,status:'pending',hash},{...intent,chainId:1,status:'pending',hash}])),[]);
  assert.deepEqual(restoreJournal('not JSON'),[]);
});

test('failed live reads reject instead of substituting seed balances',async()=>{
  const gateway=createChainGateway(fake({getChainId:async()=>{throw new Error('RPC offline');}}));
  await assert.rejects(gateway.snapshot([{label:'A',address:a as Address}]),/RPC offline/);
});
