import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeedback } from '../game/feedback.js';

function mockAudio() {
  let context, resume;
  const starts = [];
  class AudioContext {
    constructor() { context = this; this.state = 'suspended'; this.currentTime = 2; this.destination = {}; }
    resume() { return new Promise(resolve => { resume = () => { this.state = 'running'; resolve(); }; }); }
    createOscillator() { return { frequency:{}, connect(){}, disconnect(){}, start(t){starts.push(t);}, stop(){} }; }
    createGain() { return { gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){}, disconnect(){} }; }
  }
  return { environment:{ AudioContext }, starts, resume:()=>resume(), context:()=>context };
}
test('mobile tones wait for resume and resume again after interruption', async () => {
  const mock = mockAudio();
  const feedback = createFeedback({isSoundEnabled:()=>true,environment:mock.environment});
  const first = feedback.tone(true);
  assert.equal(mock.starts.length,0);
  mock.resume(); await first;
  assert.equal(mock.starts.length,3);
  assert.ok(mock.starts.every(t=>t > 2));
  mock.context().state='interrupted';
  const second=feedback.tone(false);
  assert.equal(mock.starts.length,3);
  mock.resume(); await second;
  assert.equal(mock.starts.length,4);
});
test('muting during resume suppresses pending sound, unavailable APIs are harmless',async()=>{
  const mock=mockAudio(); let enabled=true;
  const feedback=createFeedback({isSoundEnabled:()=>enabled,environment:mock.environment});
  const pending=feedback.tone(true);enabled=false;mock.resume();await pending;
  assert.equal(mock.starts.length,0);
  const unsupported=createFeedback({isSoundEnabled:()=>true,environment:{}});
  await unsupported.tone(true);unsupported.vibrate();
});
test('haptics are a short pulse and respect reduced motion',()=>{
  const pulses=[];
  const environment={navigator:{vibrate:ms=>pulses.push(ms)}};
  createFeedback({isSoundEnabled:()=>false,environment}).vibrate();
  createFeedback({isSoundEnabled:()=>true,environment,reducedMotion:true}).vibrate();
  assert.deepEqual(pulses,[12]);
});
