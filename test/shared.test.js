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
});

test('extractName accepts a line that starts with "พี่"', () => {
  assert.equal(extractName('พี่บราวน์'), 'พี่บราวน์');
  assert.equal(extractName('โน้ต 1/1000\nพี่บราวน์\n6 ส.ค. 2026 2.14 น. BIRD'), 'พี่บราวน์');
  assert.equal(extractName('พี่ บราวน์'), 'พี่บราวน์');
  assert.equal(extractName('ชื่อ มายด์\nพี่บราวน์'), 'พี่บราวน์');
  assert.equal(extractName('พี่น้ำ\n\nDUANGTHIP NAK\nชื่อ - นามสกุล : ดวงทิพย์ นาคปลัด\nเบอร์โทรศัพท์ : 0968986860\nชื่อธนาคาร : ธนาคารไทยพาณิชย์'), 'พี่น้ำ');
  assert.equal(extractName('ลูกค้าบอกว่าพี่เขาโอนแล้ว'), '');
  assert.equal(extractName('พี่'), '');
});

test('extractName accepts other titles only as a whole line', () => {
  assert.equal(extractName('เฮียตี๋'), 'เฮียตี๋');
  assert.equal(extractName('โน้ต\nคุณ มายด์\nฝากเงิน'), 'คุณมายด์');
  assert.equal(extractName('คุณลูกค้าแจ้งว่าโอนแล้ว รอตรวจสอบ'), '');
  assert.equal(extractName('เจ๊แจ้งถอน 500 แล้ว'), '');
});

test('extractName ignores notes without a usable "ชื่อ"', () => {
  assert.equal(extractName('มายด์'), '');
  assert.equal(extractName(''), '');
  assert.equal(extractName('ชื่อบัญชี สมชาย'), '');
  assert.equal(extractName('ชื่อบัญชี สมชาย\nชื่อ มายด์'), 'มายด์');
  assert.equal(extractName('ชื่อไลน์ mind99'), '');
  assert.equal(extractName('ชื่อ-นามสกุล: สมชาย ใจดี'), '');
  assert.equal(extractName('ชื่อ - นามสกุล : ดวงทิพย์ นาคปลัด\nชื่อธนาคาร : ธนาคารไทยพาณิชย์'), '');
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
  const withSets = [{ id: '3', name: 'ถอน', category: 'ถอน', sets: [{ text: 'กำลังดำเนินการ' }, { text: 'ขออภัยในความล่าช้า' }] }];
  assert.deepEqual(searchReplies(withSets, 'ล่าช้า').map((r) => r.id), ['3']);
});

test('fillName inserts the name or removes the field', () => {
  const text = 'สวัสดีครับคุณ {ชื่อ} ฝากเงินได้ตามขั้นตอนด้านล่างครับ';
  assert.equal(needsName(text), true);
  assert.equal(fillName(text, 'มายด์'), 'สวัสดีครับคุณ มายด์ ฝากเงินได้ตามขั้นตอนด้านล่างครับ');
  assert.equal(fillName(text, ''), 'สวัสดีครับ ฝากเงินได้ตามขั้นตอนด้านล่างครับ');
  assert.equal(fillName('คุณ {ชื่อ} รบกวนส่งสลิปครับ', ''), 'รบกวนส่งสลิปครับ');
  const greet = '💌 สวัสดีค่ะ {ชื่อ} น้องขนม JINBAO356 ยินดีให้บริการค่ะ 💌';
  assert.equal(fillName(greet, 'พี่มายด์'), '💌 สวัสดีค่ะ พี่มายด์ น้องขนม JINBAO356 ยินดีให้บริการค่ะ 💌');
  assert.equal(fillName(greet, ''), '💌 สวัสดีค่ะ น้องขนม JINBAO356 ยินดีให้บริการค่ะ 💌');
  assert.equal(fillName(text, 'พี่บราวน์'), 'สวัสดีครับพี่บราวน์ ฝากเงินได้ตามขั้นตอนด้านล่างครับ');

});
