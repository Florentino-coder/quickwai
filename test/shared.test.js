const test = require('node:test');
const assert = require('node:assert');
const { extractName } = require('../extension/extract-name.js');
const { EN, TH, searchReplies, fillName, needsName } = require('../desktop/ui/shared.js');

test('extractName reads the word after "ชื่อ"', () => {
  assert.equal(extractName('ชื่อ มายด์'), 'มายด์');
  assert.equal(extractName('ชื่อ: มายด์'), 'มายด์');
  assert.equal(extractName('ชื่อมายด์'), 'มายด์');
  assert.equal(extractName('ชื่อเล่น มายด์'), 'มายด์');
  assert.equal(extractName('เบอร์ 0812345678\nชื่อ มายด์ ลูกค้าเก่า'), 'มายด์');
  assert.equal(extractName('ชื่อ-นามสกุล: สมชาย ใจดี'), 'สมชาย');
});

test('extractName ignores notes without a usable "ชื่อ"', () => {
  assert.equal(extractName('มายด์'), '');
  assert.equal(extractName(''), '');
  assert.equal(extractName('ชื่อบัญชี สมชาย'), '');
  assert.equal(extractName('ชื่อบัญชี สมชาย\nชื่อ มายด์'), 'มายด์');
  assert.equal(extractName('ชื่อไลน์ mind99'), '');
});

test('keyboard layout tables line up', () => {
  assert.equal(EN.length, TH.length);
});

test('searchReplies matches text typed with the wrong layout', () => {
  const replies = [
    { id: '1', name: 'วิธีฝากเงิน', text: '', category: 'ฝาก', hotkey: 'Alt+1' },
    { id: '2', name: 'วิธีถอนเงิน', text: '', category: 'ถอน', hotkey: 'Alt+2' },
  ];
  assert.deepEqual(searchReplies(replies, 'ฝาก').map((r) => r.id), ['1']);
  assert.deepEqual(searchReplies(replies, '/kd').map((r) => r.id), ['1']);
  assert.deepEqual(searchReplies(replies, '', 'ถอน').map((r) => r.id), ['2']);
  assert.equal(searchReplies(replies, '').length, 2);
});

test('fillName inserts the name or removes the field', () => {
  const text = 'สวัสดีครับคุณ {ชื่อ} ฝากเงินได้ตามขั้นตอนด้านล่างครับ';
  assert.equal(needsName(text), true);
  assert.equal(fillName(text, 'มายด์'), 'สวัสดีครับคุณ มายด์ ฝากเงินได้ตามขั้นตอนด้านล่างครับ');
  assert.equal(fillName(text, ''), 'สวัสดีครับ ฝากเงินได้ตามขั้นตอนด้านล่างครับ');
  assert.equal(fillName('คุณ {ชื่อ} รบกวนส่งสลิปครับ', ''), 'รบกวนส่งสลิปครับ');
});
