const test = require('node:test');
const assert = require('node:assert');
const { createChannel } = require('../desktop/channel.js');

test('a command answers the open request and resolves on its ack', async () => {
  const channel = createChannel();
  const got = [];
  channel.wait((payload) => got.push(payload));
  const sent = channel.send({ type: 'focusInput', tabId: 7 }, 500);
  assert.equal(got.length, 1);
  assert.equal(got[0].type, 'focusInput');
  assert.equal(got[0].tabId, 7);
  channel.ack(got[0].n, true);
  assert.equal(await sent, true);
});

test('a command times out without an ack, or with a failed one', async () => {
  const channel = createChannel();
  const got = [];
  channel.wait((payload) => got.push(payload));
  const sent = channel.send({ type: 'focusInput' }, 30);
  channel.ack(got[0].n, false);
  assert.equal(await sent, false);
});

test('a command sent between two polls reaches the next poll', async () => {
  const channel = createChannel();
  const sent = channel.send({ type: 'focusInput' }, 500);
  const got = [];
  channel.wait((payload) => got.push(payload));
  assert.equal(got.length, 1);
  channel.ack(got[0].n, true);
  assert.equal(await sent, true);
});

test('an idle request gets an empty answer, and a closed one gets none', async () => {
  const channel = createChannel({ holdMs: 20 });
  const got = [];
  channel.wait((payload) => got.push(payload));
  const close = channel.wait((payload) => got.push(payload));
  close();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(got, [{}]);
  assert.equal(await channel.send({ type: 'focusInput' }, 20), false);
});
