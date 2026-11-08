import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, parseAbi, type Hex } from 'viem';
import { inspectTransfer, inspectAnchor, TESTNET } from '../src/lib/testnet-proof.ts';
const recipient = '0x1AdCD45D8FF8aA19689b49e799A03FbD194809b9' as const;
const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const good = {status:'success',to:TESTNET.units,blockNumber:BigInt(52800985),logs:[{
  address:TESTNET.units,
  topics:encodeEventTopics({abi,eventName:'Transfer',args:{from:TESTNET.investorA,to:recipient}}) as Hex[],
  data:encodeAbiParameters([{type:'uint256'}],[BigInt(50)]),
}]};
test('transfer proof requires a successful receipt and the exact contract event',()=>{
  assert.deepEqual(inspectTransfer(good),{from:TESTNET.investorA,to:recipient,units:'50',block:'52800985'});
  assert.throws(()=>inspectTransfer({...good,status:'reverted'}));
  assert.throws(()=>inspectTransfer({...good,to:recipient}));
  assert.throws(()=>inspectTransfer({...good,logs:[]}));
  assert.throws(()=>inspectTransfer({...good,logs:[{...good.logs[0],address:recipient}]}));
  assert.throws(()=>inspectTransfer({...good,logs:[{...good.logs[0],data:encodeAbiParameters([{type:'uint256'}],[BigInt(51)])}]}));
});
test('anchor proof requires matching digest, record and emitting registry',()=>{
  const record = `0x${'a'.repeat(64)}` as Hex;
  const anchorAbi=parseAbi(['event DocumentAnchored(bytes32 indexed digest, bytes32 indexed recordIdHash, address indexed anchorer, uint64 timestamp)']);
  const receipt={status:'success',to:TESTNET.registry,blockNumber:BigInt(52734562),logs:[{
    address:TESTNET.registry,
    topics:encodeEventTopics({abi:anchorAbi,eventName:'DocumentAnchored',args:{digest:TESTNET.digest,recordIdHash:record,anchorer:recipient}}) as Hex[],
    data:encodeAbiParameters([{type:'uint64'}],[BigInt(12345)]),
  }]};
  assert.equal(inspectAnchor(receipt,record),true);
  assert.equal(inspectAnchor(receipt,`0x${'b'.repeat(64)}`),false);
  assert.equal(inspectAnchor({...receipt,logs:[{...receipt.logs[0],address:recipient}]},record),false);
  assert.throws(()=>inspectAnchor({...receipt,status:'reverted'},record));
});
