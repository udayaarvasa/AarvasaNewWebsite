import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialOwnershipDemo, issuedUnits, ownershipDemoReducer as reduce } from '../src/lib/ownership-demo.ts';

test('issuance requires an allowlisted recipient and respects the supply cap', () => {
  const initial = initialOwnershipDemo();
  let state = reduce(initial, {type:'issue',investor:'C',amount:250,at:1});
  assert.deepEqual(state.investors, initial.investors);
  assert.equal(state.events[0].status, 'blocked');
  state = reduce(state, {type:'allowlist',investor:'C',enabled:true,at:2});
  state = reduce(state, {type:'issue',investor:'C',amount:250,at:3});
  assert.equal(issuedUnits(state), 1250);
  const before = state.investors;
  state = reduce(state, {type:'issue',investor:'C',amount:9000,at:4});
  assert.deepEqual(state.investors, before);
  assert.equal(state.events[0].status,'blocked');
});

test('transfers conserve supply and cannot overdraw or use disallowed wallets', () => {
  const initial = initialOwnershipDemo();
  let state = reduce(initial, {type:'transfer',from:'A',to:'B',amount:50,at:1});
  assert.deepEqual(state.investors.map(i=>i.units), [650,350,0]);
  assert.equal(issuedUnits(state), issuedUnits(initial));
  for (const action of [
    {type:'transfer' as const,from:'A',to:'B',amount:651,at:2},
    {type:'transfer' as const,from:'A',to:'C',amount:10,at:3},
    {type:'transfer' as const,from:'A',to:'A',amount:10,at:4},
  ]) {
    const before = state.investors;
    state = reduce(state, action);
    assert.deepEqual(state.investors, before);
    assert.equal(state.events[0].status,'blocked');
  }
});

test('pause blocks issuance and transfer until resumed; invalid amounts never mutate balances', () => {
  let state = reduce(initialOwnershipDemo(),{type:'pause',paused:true,at:1});
  for (const action of [
    {type:'transfer' as const,from:'A',to:'B',amount:10,at:2},
    {type:'issue' as const,investor:'A',amount:100,at:3},
  ]) {
    state = reduce(state,action);
    assert.equal(issuedUnits(state),1000);
    assert.deepEqual(state.investors.map(i=>i.units),[700,300,0]);
    assert.equal(state.events[0].status,'blocked');
  }
  state = reduce(state,{type:'pause',paused:false,at:4});
  for (const amount of [-1,0,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    state = reduce(state,{type:'issue',investor:'A',amount,at:5});
    assert.equal(issuedUnits(state),1000);
    assert.equal(state.events[0].status,'blocked');
  }
  state = reduce(state,{type:'transfer',from:'A',to:'B',amount:10,at:6});
  assert.deepEqual(state.investors.map(i=>i.units),[690,310,0]);
});

test('anchoring requires review and a valid digest; repeats create no duplicate records', () => {
  let state = initialOwnershipDemo();
  const doc = state.documents.find(d=>d.id==='building')!;
  const digest = createHash('sha256').update(doc.content).digest('hex');
  state = reduce(state,{type:'anchor',document:doc.id,digest,at:1});
  assert.equal(state.documents.find(d=>d.id===doc.id)?.status,'draft');
  state = reduce(state,{type:'review',document:doc.id,at:2});
  state = reduce(state,{type:'anchor',document:doc.id,digest:'invalid',at:3});
  assert.equal(state.documents.find(d=>d.id===doc.id)?.status,'reviewed');
  state = reduce(state,{type:'anchor',document:doc.id,digest,at:4});
  assert.equal(state.documents.find(d=>d.id===doc.id)?.digest,digest);
  const records = state.events.length;
  state = reduce(state,{type:'anchor',document:doc.id,digest,at:5});
  assert.equal(state.events.length,records);
  assert.deepEqual(reduce(state,{type:'reset'}),initialOwnershipDemo());
});
