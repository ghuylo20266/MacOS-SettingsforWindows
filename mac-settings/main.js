const { app, BrowserWindow, ipcMain, nativeTheme, shell, screen, dialog } = require('electron');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const run = (cmd) => new Promise((res) => exec(cmd, { windowsHide: true, maxBuffer: 1 << 24 }, (e, out) => res(String(out || ''))));
const { spawn } = require('child_process');
const POOL = [], Q = []; let rid = 0;
function mk() {
  const p = spawn('powershell', ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], { windowsHide: true });
  const w = { p, busy: false, buf: '', tag: '', cb: null }; POOL.push(w);
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (d) => { w.buf += d; const k = w.tag ? w.buf.indexOf(w.tag) : -1; if (w.cb && k >= 0) { const o = w.buf.slice(0, k), cb = w.cb; w.cb = null; w.busy = false; w.buf = ''; cb(o); next(); } });
  p.on('exit', () => { const x = POOL.indexOf(w); if (x >= 0) POOL.splice(x, 1); if (w.cb) { const cb = w.cb; w.cb = null; cb(''); } mk(); next(); });
  p.stdin.on('error', () => {});
  p.stdin.write('[Console]::OutputEncoding=[Text.Encoding]::UTF8;$ProgressPreference="SilentlyContinue";$ErrorActionPreference="SilentlyContinue"\n');
}
function next() {
  for (const w of POOL) {
    if (!Q.length) return; if (w.busy) continue;
    const j = Q.shift(); w.busy = true; w.tag = '<<E' + (++rid) + '>>'; w.buf = '';
    const t = setTimeout(() => { try { w.p.kill(); } catch {} }, 20000);
    w.cb = (o) => { clearTimeout(t); j.res(o); };
    w.p.stdin.write(`& ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(j.s, 'utf8').toString('base64')}')))) ; '${w.tag}'\n`);
  }
}
const ps = (s) => new Promise((res) => { Q.push({ s, res }); next(); });
const q = (s) => String(s).replace(/'/g, "''");

let win;
app.whenReady().then(() => {
  for (let n = 0; n < 3; n++) mk();
  win = new BrowserWindow({ width: 980, height: 680, minWidth: 760, minHeight: 500, frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  win.setMenuBarVisibility(false); win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());
ipcMain.on('win', (_e, a) => { if (a === 'close') win.close(); if (a === 'min') win.minimize(); if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize(); });

// ---- generic ----
ipcMain.handle('ps', (_e, s) => ps(s));
ipcMain.handle('launch', (_e, c) => run(c));
ipcMain.handle('open', (_e, u) => shell.openExternal(u));
ipcMain.handle('pick', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp'] }], properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('reg:get', async (_e, p, n) => { const m = (await run(`reg query "${p}" /v "${n}"`)).match(/REG_(\w+)\s+(.+)/); if (!m) return null; const v = m[2].trim(); return m[1] === 'DWORD' ? parseInt(v, 16) : v; });
ipcMain.handle('reg:set', (_e, p, n, t, d) => run(`reg add "${p}" /v "${n}" /t REG_${t} /d "${d}" /f`));

ipcMain.handle('sys:info', async () => {
  const u = os.userInfo(), d = screen.getPrimaryDisplay();
  return { username: u.username, fullName: u.username, host: os.hostname(), platform: os.type() + ' ' + os.release(), arch: os.arch(),
    cpu: os.cpus()[0]?.model || '', cores: os.cpus().length, mem: Math.round(os.totalmem() / 1073741824) + ' GB', uptimeSec: os.uptime(),
    display: { w: d.size.width, h: d.size.height, scale: d.scaleFactor, hz: d.displayFrequency },
    nets: Object.entries(os.networkInterfaces()).map(([n, a]) => ({ name: n, addr: (a.find(x => x.family === 'IPv4') || {}).address || '—' })) };
});
ipcMain.handle('theme:set', async (_e, mode) => {
  nativeTheme.themeSource = mode === 'auto' ? 'system' : mode;
  if (mode !== 'auto') { const k = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', v = mode === 'light' ? 1 : 0;
    await run(`reg add "${k}" /v AppsUseLightTheme /t REG_DWORD /d ${v} /f`); await run(`reg add "${k}" /v SystemUsesLightTheme /t REG_DWORD /d ${v} /f`); }
});

// ---- wifi ----
ipcMain.handle('wifi', async (_e, act, a) => {
  if (act === 'status') { const o = await run('netsh wlan show interfaces'); const g = (k) => (o.match(new RegExp('^\\s*' + k + '\\s*:\\s*(.+)$', 'm')) || [])[1]?.trim();
    return { available: /Name/i.test(o), ssid: g('SSID'), signal: g('Signal'), connected: /\bconnected\b/i.test(g('State') || '') && !/disconnected/i.test(g('State') || '') }; }
  if (act === 'known') return (await run('netsh wlan show profiles')).split('\n').filter(l => l.includes(':') && /profile/i.test(l)).map(l => l.split(':').slice(1).join(':').trim()).filter(Boolean);
  if (act === 'scan') { const nets = []; let c; (await run('netsh wlan show networks mode=bssid')).split('\n').forEach(l => { let m = l.match(/^SSID \d+ : (.*)$/);
      if (m) { c = { ssid: m[1].trim(), secured: true, signal: 0 }; nets.push(c); return; } if (c && /Authentication/.test(l)) c.secured = !/Open/i.test(l);
      m = l.match(/Signal\s*:\s*(\d+)%/); if (c && m) c.signal = Math.max(c.signal, +m[1]); }); return nets.filter(n => n.ssid); }
  if (act === 'connect') return run(`netsh wlan connect name="${a}"`);
  if (act === 'forget') return run(`netsh wlan delete profile name="${a}"`);
  if (act === 'disconnect') return run('netsh wlan disconnect');
  if (act === 'power') return run(`netsh interface set interface name="Wi-Fi" admin=${a ? 'enabled' : 'disabled'}`);
});

// ---- bluetooth (WinRT radio) ----
const BT = `Add-Type -AssemblyName System.Runtime.WindowsRuntime
$t=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'})[0]
Function Aw($x,$r){$n=$t.MakeGenericMethod($r).Invoke($null,@($x));$n.Wait(-1)|Out-Null;$n.Result}
[Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime]|Out-Null
[Windows.Devices.Radios.RadioAccessStatus,Windows.System.Devices,ContentType=WindowsRuntime]|Out-Null
Aw ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus])|Out-Null
$b=(Aw ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]))|?{$_.Kind -eq 'Bluetooth'}
`;
ipcMain.handle('bt', async (_e, act, a) => {
  if (act === 'state') return (await ps(BT + 'if($b){$b.State}else{"None"}')).trim();
  if (act === 'set') return ps(BT + `Aw ($b.SetStateAsync('${a ? 'On' : 'Off'}')) ([Windows.Devices.Radios.RadioAccessStatus])|Out-Null`);
  if (act === 'list') return (await ps(`Get-PnpDevice -Class Bluetooth -Status OK | ?{$_.FriendlyName -notmatch 'Enumerator|Radio|Adapter|Generic|Transport'} | %{$_.FriendlyName}`)).split('\n').map(s => s.trim()).filter(Boolean);
});

// ---- audio / brightness / wallpaper ----
const AUDIO = `if(-not ('Audio' -as [type])){Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAEV{int f();int g();int h();int i();int SetS(float l,System.Guid c);int j();int GetS(out float l);int k();int l();int m();int n();int SetM([MarshalAs(UnmanagedType.Bool)]bool b,System.Guid c);int GetM(out bool b);}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMD{int Activate(ref System.Guid id,int c,int p,out IAEV v);}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMDE{int f();int GetDefaultAudioEndpoint(int d,int r,out IMD e);}
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MDEC{}
public class Audio{
 static IAEV V(){var e=new MDEC() as IMDE;IMD d;e.GetDefaultAudioEndpoint(0,1,out d);var g=typeof(IAEV).GUID;IAEV v;d.Activate(ref g,23,0,out v);return v;}
 public static float Vol{get{float f;V().GetS(out f);return f;}set{V().SetS(value,System.Guid.Empty);}}
 public static bool Mute{get{bool b;V().GetM(out b);return b;}set{V().SetM(value,System.Guid.Empty);}}
}
'@}
`;
ipcMain.handle('vol', async (_e, act, a) => {
  if (act === 'get') { const o = (await ps(AUDIO + '[int]([Audio]::Vol*100);[Audio]::Mute')).trim().split(/\s+/); return { vol: +o[0] || 0, mute: /true/i.test(o[1]) }; }
  if (act === 'set') return ps(AUDIO + `[Audio]::Vol=${+a / 100}`);
  if (act === 'mute') return ps(AUDIO + `[Audio]::Mute=$${a ? 'true' : 'false'}`);
});
ipcMain.handle('bright', async (_e, act, a) => {
  if (act === 'get') { const o = (await ps('(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -EA SilentlyContinue).CurrentBrightness')).trim(); return o === '' ? null : +o; }
  return ps(`(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1,${+a})|Out-Null`);
});
ipcMain.handle('wall', (_e, p) => ps(`if(-not ('W' -as [type])){Add-Type 'using System.Runtime.InteropServices;public class W{[DllImport("user32.dll",CharSet=CharSet.Auto)]public static extern int SystemParametersInfo(int a,int b,string c,int d);}'};[W]::SystemParametersInfo(20,0,'${q(p)}',3)|Out-Null`));

// ---- power / battery ----
const hex = (o) => [...o.matchAll(/0x([0-9a-f]+)/gi)].map(m => Math.round(parseInt(m[1], 16) / 60)).slice(-2);
ipcMain.handle('power:get', async () => ({ mon: hex(await run('powercfg /q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE')), slp: hex(await run('powercfg /q SCHEME_CURRENT SUB_SLEEP STANDBYIDLE')) }));
ipcMain.handle('power:set', (_e, k, m) => run(`powercfg /change ${k} ${+m}`));
ipcMain.handle('battery', async () => { const o = (await ps('$b=Get-CimInstance Win32_Battery;if($b){"$($b.EstimatedChargeRemaining)|$($b.BatteryStatus)"}')).trim(); if (!o) return null; const [p, s] = o.split('|'); return { pct: +p, charging: s === '2' }; });
