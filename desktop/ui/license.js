const $ = (id) => document.getElementById(id);

function showError(reason) {
  $('error').textContent = reason;
  $('error').hidden = !reason;
}

async function activate() {
  const code = $('code').value.trim();
  if (!code) return showError('วางโค้ดก่อน');
  const result = await qr.activate(code);
  if (!result.ok) showError(result.reason);
}

$('activate').onclick = activate;
$('quit').onclick = () => qr.quit();
$('copyMachine').onclick = () => qr.copy($('machine').textContent);
$('code').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    activate();
  }
});

qr.licenseInfo().then((info) => {
  $('machine').textContent = info.machineId;
  showError(info.reason);
});
