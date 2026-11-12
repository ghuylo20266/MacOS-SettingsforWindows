const $ = (s) => document.querySelector(s);
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
const call = api.i, enc = (o) => encodeURIComponent(JSON.stringify(o)), dec = (s) => JSON.parse(decodeURIComponent(s));
const I = (c) => `<i class="fi">${String.fromCodePoint(parseInt(c, 16))}</i>`;
let SYS = {}, current = 'wifi', hist = [], fwd = [];

const EXP = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', PERS = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
  SRCH = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', NOT = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings',
  CAP = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\', DESK = 'HKCU\\Control Panel\\Desktop',
  ACC = 'HKCU\\Software\\Microsoft\\Accessibility', SPE = 'HKCU\\Software\\Microsoft\\Speech_OneCore\\Settings\\OnlineSpeechPrivacy';

// id, name, Segoe Fluent glyph, color, ms-settings fallback
const GROUPS = [
  [['wifi','Wi-Fi','E701','#1e90ff'],['bluetooth','Bluetooth','E702','#1e7cf0'],['network','Network','E774','#2f7df6'],['vpn','VPN','E705','#2f7df6'],['battery','Battery','E83F','#34c759']],
  [['general','General','E713','#8e8e93'],['accessibility','Accessibility','E776','#1e7cf0'],['appearance','Appearance','E771','#1c1c1e'],['siri','Apple Intelligence & Siri','E720','#b066e8'],['control','Control Center','E8FD','#8e8e93'],['dock','Desktop & Dock','E7C4','#1c1c1e'],['displays','Displays','E7F4','#1e90ff'],['screensaver','Screen Saver','E8B9','#5ac8fa'],['spotlight','Spotlight','E721','#8e8e93'],['wallpaper','Wallpaper','E91B','#5ac8fa']],
  [['notifications','Notifications','E7E7','#ff3b30'],['sound','Sound','E767','#ff2d55'],['focus','Focus','E708','#5856d6'],['screentime','Screen Time','E823','#5856d6']],
  [['lock','Lock Screen','E72E','#1c1c1e'],['privacy','Privacy & Security','EA18','#1e7cf0'],['touchid','Touch ID & Password','E77B','#ff6b81'],['users','Users & Groups','E716','#1e90ff']]
];
const ALL = GROUPS.flat(), get = (id) => ALL.find(i => i[0] === id);
const tile = (it) => `<span class="ic" style="background:linear-gradient(180deg,color-mix(in srgb,${it[3]} 78%,#fff),${it[3]})">${I(it[2])}</span>`;
const row = (l, r = '', s = '') => `<div class="row"><div>${l}${s ? `<div class="s">${s}</div>` : ''}</div><div class="v">${r}</div></div>`;
const card = (h, st = '') => `<div class="card" style="${st}">${h}</div>`, h2 = (t) => `<h2>${t}</h2>`;
const hero = (it, t, p) => card(`<div class="hero">${tile(it)}<h3>${t}</h3><p>${p}</p></div>`);
const btn = (t, d, a = '', c = '') => `<button class="btn ${c}" data-do="${d}" data-arg="${a}">${t}</button>`;
const tg = (on, d, a) => `<div class="tg ${on ? 'on' : ''}" data-do="${d}" data-arg="${a}"></div>`;
const sel = (o, cur, d, a) => `<select data-do="${d}" data-arg="${a}">${o.map(([v, t]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
const rng = (v, min, max, d, a = '') => `<input type="range" min="${min}" max="${max}" value="${v}" data-do="${d}" data-arg="${a}">`;
const open = (uri) => btn('Open…', 'open', uri);
const lines = async (s) => (await call('ps', s)).split('\n').map(x => x.trim()).filter(Boolean);
const rv = (p, n) => call('reg:get', p, n);
async function rt(label, p, n, t, onV, offV, def = 0, sub = '') { const v = await rv(p, n); return row(label, tg(v === null ? def : String(v) === String(onV), 'reg', enc([p, n, t, onV, offV])), sub); }
async function rs(label, p, n, t, opts, def) { const v = await rv(p, n); return row(label, sel(opts, v === null ? def : v, 'regsel', enc([p, n, t]))); }
const MIN = [[1, '1 minute'], [2, '2 minutes'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [0, 'Never']];
const fmt = (s) => { s = Math.round(s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + ' d ' : '') + h + ' h ' + m + ' min'; };

function buildNav(f = '') {
  const nav = $('#nav'); nav.innerHTML = '';
  if (!f) nav.append(el(`<div class="user" data-id="users"><div class="av">${(SYS.fullName || '?')[0].toUpperCase()}</div><div>${SYS.fullName || ''}<small>Windows Account</small></div></div>`));
  GROUPS.forEach(g => { const its = g.filter(i => i[1].toLowerCase().includes(f.toLowerCase())); if (!its.length) return;
    its.forEach(i => nav.append(el(`<div class="item ${i[0] === current ? 'on' : ''}" data-id="${i[0]}">${tile(i)}<span>${i[1]}</span></div>`))); nav.append(el('<div class="sep"></div>')); });
  nav.querySelectorAll('[data-id]').forEach(n => n.onclick = () => go(n.dataset.id));
}
const CACHE = {}; let tok = 0, shown = '';
const skel = '<div class="card sk"></div><h2>&nbsp;</h2><div class="card sk" style="height:150px"></div>';
function show(html) { const p = $('#page'), top = p.scrollTop; p.innerHTML = ''; p.append(el('<div>' + html + '</div>')); p.scrollTop = top; shown = html; }
const render = async (id) => { try { return await PAGES[id](get(id)); } catch (e) { return card(row('Could not load this pane', String(e))); } };
async function go(id, push = true, fresh = false) {
  if (push && id !== current) { hist.push(current); fwd = []; }
  const changed = id !== current; current = id; buildNav($('#q').value); $('#title').textContent = get(id)[1];
  const t = ++tok;
  if (changed) $('#page').scrollTop = 0;
  if (changed || !fresh) show(CACHE[id] || skel);
  const html = await render(id); CACHE[id] = html;
  if (t !== tok || html === shown) return;
  const a = document.activeElement; if (a && $('#page').contains(a) && ['SELECT', 'INPUT'].includes(a.tagName)) return;
  show(html);
}
const refresh = () => go(current, false, true);
function prefetch() { const ids = ALL.map(i => i[0]).filter(i => !CACHE[i]); let n = 0; const w = async () => { while (n < ids.length) { const id = ids[n++]; if (!CACHE[id]) CACHE[id] = await render(id); } }; w(); w(); }
const toast = (m, fn) => { const t = $('#toast'); t.innerHTML = m + (fn ? ' <button class="btn p" id="tb">Restart Explorer</button>' : ''); t.style.display = 'flex'; if (fn) $('#tb').onclick = () => { fn(); t.style.display = 'none'; }; setTimeout(() => t.style.display = 'none', 7000); };
const restartExp = () => call('launch', 'taskkill /f /im explorer.exe & start explorer.exe');
const MODES = ['auto', 'light', 'dark'];

const PAGES = {
  async wifi(it) {
    const s = await call('wifi', 'status'), known = await call('wifi', 'known'), nets = await call('wifi', 'scan');
    return card(row(`${tile(it)} &nbsp;<b>Wi-Fi</b>`, tg(s.available && (s.connected || nets.length > 0), 'wifipw'))) +
      (s.connected ? card(row(`${I('E701')} ${s.ssid}`, btn('Disconnect', 'wdisc'), '● Connected · ' + (s.signal || '')), 'margin-top:10px') : '') + h2('Known Networks') +
      card(known.map(n => row(`${s.connected && s.ssid === n ? '✓ ' : ''}${n}`, btn('Join', 'wconn', n) + ' ' + btn('Forget', 'wforget', n))).join('') || row('No known networks')) + h2('Other Networks') +
      card(nets.filter(n => !known.includes(n.ssid)).map(n => row(n.ssid, `${n.secured ? I('E72E') + ' ' : ''}${n.signal}%`)).join('') || row('No networks found'));
  },
  async bluetooth(it) {
    const st = await call('bt', 'state'), dev = await call('bt', 'list');
    return card(row(`${tile(it)} &nbsp;<b>Bluetooth</b>`, st === 'None' ? 'No adapter' : tg(st === 'On', 'btset'), st === 'On' ? 'Now discoverable' : '')) +
      h2('My Devices') + card(dev.length ? dev.map(d => row(d, 'Connected')).join('') : '<div class="center">No Bluetooth Devices</div>') +
      h2('Nearby Devices') + card(row('Pair a new device', btn('Connect', 'open', 'ms-settings:bluetooth', 'p')));
  },
  async network() {
    const s = await call('wifi', 'status'), fw = await call('ps', '(Get-NetFirewallProfile -Name Public).Enabled');
    return card(row(`${I('E701')} Wi-Fi`, s.connected ? '<span class="ok">●</span> Connected' : 'Not connected') + row(`${I('EA18')} Firewall`, tg(/true/i.test(fw), 'fw'), /true/i.test(fw) ? 'Active' : 'Inactive')) +
      h2('Interfaces') + card(SYS.nets.map(n => row(n.name, n.addr)).join('')) + h2('Other Services') +
      card(row('Proxy', open('ms-settings:network-proxy')) + row('Advanced network settings', open('ms-settings:network-advancedsettings')) + row('Flush DNS cache', btn('Flush', 'launch', 'ipconfig /flushdns')));
  },
  async vpn(it) {
    const v = await lines('Get-VpnConnection -EA SilentlyContinue | %{"$($_.Name)|$($_.ConnectionStatus)"}');
    return card(v.length ? v.map(l => { const [n, s] = l.split('|'); return row(n, btn(s === 'Connected' ? 'Disconnect' : 'Connect', 'vpn', n + '|' + s), s); }).join('') : '<div class="center">No VPN configurations</div>') + h2('Add') + card(row('Add VPN Configuration', btn('Add…', 'open', 'ms-settings:network-vpn', 'p')));
  },
  async battery() {
    const b = await call('battery'), p = await call('power:get'), t = (k) => p[k];
    return card(b ? row(`${I('E83F')} Battery`, `<div class="bar"><i style="width:${b.pct}%"></i></div>`, `${b.pct}% ${b.charging ? '· Charging' : ''}`) : row('No battery detected', 'Desktop PC')) +
      h2('Power') + card(row('Turn display off on battery', sel(MIN, p.mon[1], 'pw', 'monitor-timeout-dc')) + row('Turn display off when plugged in', sel(MIN, p.mon[0], 'pw', 'monitor-timeout-ac')) +
        row('Sleep on battery', sel(MIN, p.slp[1], 'pw', 'standby-timeout-dc')) + row('Sleep when plugged in', sel(MIN, p.slp[0], 'pw', 'standby-timeout-ac'))) +
      h2('More') + card(row('Battery saver', open('ms-settings:batterysaver')) + row('Power mode', open('ms-settings:powersleep')));
  },
  async general(it) {
    const dr = await lines('Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|%{"$($_.DeviceID)|$($_.Size)|$($_.FreeSpace)"}'),
      tz = (await call('ps', '(Get-TimeZone).DisplayName')).trim(), cu = (await call('ps', '(Get-Culture).DisplayName')).trim(), now = new Date().toLocaleString();
    return hero(it, 'General', 'Manage your overall setup and preferences for your PC.') + h2('About') +
      card(row('Name', SYS.host) + row('System', SYS.platform) + row('Chip', `${SYS.cpu} (${SYS.cores} cores)`) + row('Memory', SYS.mem) + row('Architecture', SYS.arch) + row('Uptime', fmt(SYS.uptimeSec))) + h2('Storage') +
      card(dr.map(l => { const [d, s, f] = l.split('|'), u = s - f; return row(d, `<div class="bar"><i style="width:${Math.round(u / s * 100)}%"></i></div>`, `${(u / 1e9).toFixed(0)} GB used of ${(s / 1e9).toFixed(0)} GB`); }).join('')) +
      h2('Date, Time & Language') + card(row('Current time', now) + row('Time zone', tz) + row('Language & Region', cu) + row('Date & Time', open('ms-settings:dateandtime')) + row('Language & Region settings', open('ms-settings:regionlanguage'))) +
      h2('Software') + card(row('Software Update', btn('Check…', 'open', 'ms-settings:windowsupdate')) + row('Startup items', open('ms-settings:startupapps')) + row('Storage settings', open('ms-settings:storagesense')));
  },
  async accessibility(it) {
    const ts = (await rv(ACC, 'TextScaleFactor')) || 100, cs = (await rv(ACC, 'CursorSize')) || 1;
    return hero(it, 'Accessibility', 'Vision, hearing and interaction.') + h2('Vision') +
      card(row('Text size', rng(ts, 100, 225, 'regrng', enc([ACC, 'TextScaleFactor', 'DWORD'])), ts + '%') + row('Pointer size', rng(cs, 1, 15, 'regrng', enc([ACC, 'CursorSize', 'DWORD']))) + await rt('Transparency effects', PERS, 'EnableTransparency', 'DWORD', 1, 0, 1) +
        row('Magnifier', btn('Open', 'launch', 'start magnify')) + row('Narrator', btn('Open', 'launch', 'start narrator')) + row('Contrast themes', open('ms-settings:easeofaccess-highcontrast'))) +
      h2('Interaction') + card(row('On-Screen Keyboard', btn('Open', 'launch', 'start osk')) + row('Voice access', btn('Open', 'launch', 'start voiceaccess')) + row('Keyboard, mouse & captions', open('ms-settings:easeofaccess-keyboard')));
  },
  async appearance() {
    const m = localStorage.getItem('mode') || 'auto', ac = localStorage.getItem('accent') || '#0a64f0', cols = ['#0a64f0', '#9b3a9b', '#ff5fa2', '#e03131', '#fd7e14', '#fcc419', '#40c057', '#868e96'];
    const o = (k, n) => `<div class="opt ${m === k ? 'on' : ''}" data-do="mode" data-arg="${k}"><div class="th ${k[0]}"></div>${n}</div>`;
    return card(row('Appearance', `<div class="opts">${o('auto', 'Auto')}${o('light', 'Light')}${o('dark', 'Dark')}</div>`)) + h2('Theme') +
      card(row('Color', `<div class="dots">${cols.map(c => `<div class="dot ${c === ac ? 'on' : ''}" data-do="accent" data-arg="${c}" style="background:${c}"></div>`).join('')}</div>`, 'Also applied as the Windows accent color') + await rt('Transparency effects', PERS, 'EnableTransparency', 'DWORD', 1, 0, 1) + await rt('Show accent color on title bars', 'HKCU\\Software\\Microsoft\\Windows\\DWM', 'ColorPrevalence', 'DWORD', 1, 0, 0));
  },
  async siri(it) {
    const vs = (await lines(`Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Speech\\Voices\\Tokens'|%{"$($_.Name)|$((Get-Item $_.PSPath).GetValue(''))"}`)).map(l => l.split('|')),
      cur = await rv('HKCU\\Software\\Microsoft\\Speech\\Voices', 'DefaultTokenId'), lang = (await call('ps', '(Get-WinUserLanguageList)[0].LanguageTag')).trim();
    return card(`<div class="row"><div style="display:flex;gap:12px;align-items:center">${tile(it).replace('class="ic"', 'class="ic" style="width:40px;height:40px;font-size:20px;background:#b066e8"')}<div><b>Apple Intelligence & Siri</b><div class="s">Voice, dictation and speech services on your PC.</div></div></div></div>`) + h2('Siri Requests') +
      card(await rt('Siri (online speech recognition)', SPE, 'HasAccepted', 'DWORD', 1, 0, 0) + row('Listen for', 'Off ' + btn('Voice access', 'launch', 'start voiceaccess')) + row('Keyboard shortcut', 'Win + H') + row('Language', lang) +
        row('Voice', sel(vs.map(([id, n]) => [id, n || id]), cur, 'voice', '') + ' ' + btn('Test', 'speak')) + row('Siri history', btn('Delete Siri & Dictation History…', 'open', 'ms-settings:privacy-speech'))) +
      '<p class="s" style="margin:10px 4px;color:var(--sub)">Voice input is processed on your PC. Online recognition sends audio to Microsoft.</p>';
  },
  async control(it) {
    return hero(it, 'Control Center', 'Choose which items appear on the taskbar.') + h2('Taskbar items') +
      card(await rs('Search', SRCH, 'SearchboxTaskbarMode', 'DWORD', [[0, 'Hide'], [1, 'Icon only'], [2, 'Search box'], [3, 'Icon and label']], 1) + await rt('Task View', EXP, 'ShowTaskViewButton', 'DWORD', 1, 0, 1) + await rt('Widgets', EXP, 'TaskbarDa', 'DWORD', 1, 0, 1) +
        await rt('Chat', EXP, 'TaskbarMn', 'DWORD', 1, 0, 1) + await rt('Copilot', EXP, 'ShowCopilotButton', 'DWORD', 1, 0, 1)) + h2('Apply') + card(row('Some changes need Explorer to restart', btn('Restart Explorer', 'rexp', '', 'p')));
  },
  async dock(it) {
    return hero(it, 'Desktop & Dock', 'Taskbar and desktop behavior.') + h2('Taskbar') +
      card(await rs('Taskbar alignment', EXP, 'TaskbarAl', 'DWORD', [[0, 'Left'], [1, 'Center']], 1) + await rt('Show seconds in clock', EXP, 'ShowSecondsInSystemClock', 'DWORD', 1, 0, 0)) + h2('Desktop & Explorer') +
      card(await rt('Show desktop icons', EXP, 'HideIcons', 'DWORD', 0, 1, 1) + await rt('Show file extensions', EXP, 'HideFileExt', 'DWORD', 0, 1, 1) + await rt('Show hidden files', EXP, 'Hidden', 'DWORD', 1, 2, 0)) +
      h2('Apply') + card(row('Restart Explorer to apply', btn('Restart Explorer', 'rexp', '', 'p')));
  },
  async displays(it) {
    const d = SYS.display, br = await call('bright', 'get');
    return hero(it, 'Displays', 'Built-in Display') + card(row('Resolution', `${d.w} × ${d.h}`) + row('Scale', Math.round(d.scale * 100) + '%') + row('Refresh rate', d.hz + ' Hz') +
      (br !== null ? row('Brightness', rng(br, 0, 100, 'bright'), br + '%') : row('Brightness', 'Not supported on this display'))) + h2('More') +
      card(row('Night Light', open('ms-settings:nightlight')) + row('HDR', open('ms-settings:display-advanced')) + row('Arrange displays', open('ms-settings:display')));
  },
  async screensaver(it) {
    const list = await lines('Get-ChildItem "$env:windir\\System32\\*.scr"|%{$_.FullName}'), cur = await rv(DESK, 'SCRNSAVE.EXE'), act = await rv(DESK, 'ScreenSaveActive'), to = Math.round(((await rv(DESK, 'ScreenSaveTimeOut')) || 300) / 60);
    return hero(it, 'Screen Saver', 'Choose a screen saver and when it starts.') +
      card(row('Screen saver', sel([['', 'None'], ...list.map(p => [p, p.split('\\').pop().replace('.scr', '')])], String(act) === '1' ? cur : '', 'scr', '')) + row('Start after', sel(MIN.slice(0, 7), to, 'scrto', '')) + row('Preview', btn('Preview', 'scrprev', '', 'p')));
  },
  async spotlight(it) {
    return hero(it, 'Spotlight', 'Control Windows Search.') + h2('Search') +
      card(await rt('Web results in search', SRCH, 'BingSearchEnabled', 'DWORD', 1, 0, 1) + await rt('Search highlights', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings', 'IsDynamicSearchBoxEnabled', 'DWORD', 1, 0, 1) +
        await rt('Microsoft account results', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings', 'IsMSACloudSearchEnabled', 'DWORD', 1, 0, 1) + row('Searching Windows (indexing)', open('ms-settings:cortana-windowssearch')));
  },
  async wallpaper(it) {
    const p = await rv(DESK, 'WallPaper'), st = await rv(DESK, 'WallpaperStyle'), tl = await rv(DESK, 'TileWallpaper'), cur = tl === '1' ? 'tile' : st;
    return card(p ? `<img class="pv" src="file:///${encodeURI(p.replace(/\\/g, '/'))}">` : '<div class="center">No wallpaper</div>') + h2('Wallpaper') +
      card(row('Current picture', btn('Choose…', 'wall', '', 'p'), p || '') + row('Fit', sel([[10, 'Fill'], [6, 'Fit'], [2, 'Stretch'], ['tile', 'Tile'], [0, 'Center'], [22, 'Span']], cur, 'wstyle', '')) + row('Slideshow & colors', open('ms-settings:personalization-background')));
  },
  async notifications(it) {
    const apps = await lines(`Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings'|%{$e=(Get-ItemProperty $_.PSPath).Enabled;"$($_.PSChildName)|$(if($e -eq 0){0}else{1})"}`);
    const nice = (n) => n.split('!')[0].replace(/_.*/, '').replace(/^Microsoft\./, '').replace(/\.exe$/i, '') || n;
    return card(await rt('Allow notifications', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications', 'ToastEnabled', 'DWORD', 1, 0, 1)) + h2('Application Notifications') +
      card(apps.map(l => { const [n, e] = l.split('|'); return row(nice(n), tg(e === '1', 'reg', enc([NOT + '\\' + n, 'Enabled', 'DWORD', 1, 0]))); }).join('') || row('No apps')) + h2('More') + card(row('Notification settings', open('ms-settings:notifications')));
  },
  async sound(it) {
    const v = await call('vol', 'get'), dev = await lines('Get-CimInstance Win32_SoundDevice|%{$_.Name}');
    return hero(it, 'Sound', 'Output and input.') + h2('Output & Input') + card(row('Output volume', rng(v.vol, 0, 100, 'vol'), v.vol + '%') + row('Mute', tg(v.mute, 'mute'))) + h2('Devices') +
      card(dev.map(d => row(d, I('E767'))).join('') || row('No devices')) + h2('More') + card(row('Sound settings', open('ms-settings:sound')) + row('Volume mixer', open('ms-settings:apps-volume')));
  },
  async focus(it) {
    const v = await rv(NOT, 'NOC_GLOBAL_SETTING_TOASTS_ENABLED');
    return hero(it, 'Focus', 'Silence notifications while you concentrate.') + card(row('Do Not Disturb', tg(v === 0, 'dnd'), 'Mute all notification banners and sounds')) + h2('More') + card(row('Focus sessions & rules', open('ms-settings:quietmomentshome')));
  },
  async screentime(it) {
    const apps = await lines('Get-Process|?{$_.MainWindowTitle}|%{"$($_.Id)|$($_.ProcessName)|$([int]($_.WorkingSet64/1MB))"}');
    return hero(it, 'Screen Time', 'Time since your PC started: ' + fmt(SYS.uptimeSec)) + h2('Apps open now') +
      card(apps.map(l => { const [id, n, m] = l.split('|'); return row(n, btn('Quit', 'quit', id), m + ' MB'); }).join('') || row('No apps')) + h2('Limits') + card(row('Family Safety', open('ms-settings:family-group')));
  },
  async lock(it) {
    const p = await call('power:get');
    return hero(it, 'Lock Screen', 'Lock your PC and set when it turns off.') + card(row('Lock now', btn('Lock Screen', 'lock', '', 'p')) + row('Turn display off when plugged in', sel(MIN, p.mon[0], 'pw', 'monitor-timeout-ac')) + row('Turn display off on battery', sel(MIN, p.mon[1], 'pw', 'monitor-timeout-dc')) + row('Start screen saver now', btn('Start', 'scrprev'))) +
      h2('More') + card(row('Lock screen picture & apps', open('ms-settings:lockscreen')) + row('Require sign-in', open('ms-settings:signinoptions')));
  },
  async privacy(it) {
    const c = async (l, k) => { const v = await rv(CAP + k, 'Value'); return row(l, tg(v !== 'Deny', 'reg', enc([CAP + k, 'Value', 'SZ', 'Allow', 'Deny']))); };
    const fw = await call('ps', '(Get-NetFirewallProfile -Name Public).Enabled');
    return hero(it, 'Privacy & Security', 'Control what apps can access.') + h2('Permissions') + card(await c('Camera', 'webcam') + await c('Microphone', 'microphone') + await c('Location', 'location')) +
      h2('Security') + card(row('Firewall', tg(/true/i.test(fw), 'fw')) + row('Windows Security', btn('Open', 'launch', 'start windowsdefender:')) + row('All privacy settings', open('ms-settings:privacy')));
  },
  async touchid(it) {
    const o = await call('launch', `net user "${SYS.username}"`), g = (k) => (o.match(new RegExp(k + '[^\\n]*?\\s{2,}(.+)', 'i')) || [])[1] || '—';
    return hero(it, 'Touch ID & Password', 'Sign-in options for ' + SYS.username) + card(row('Account', SYS.username) + row('Password last set', g('Password last set')) + row('Password expires', g('Password expires')) +
      row('Windows Hello (fingerprint / face / PIN)', btn('Set up', 'open', 'ms-settings:signinoptions', 'p')) + row('Dynamic lock', open('ms-settings:signinoptions-dynamiclock')));
  },
  async users(it) {
    const us = await lines('Get-LocalUser|%{"$($_.Name)|$($_.Enabled)"}'), ad = (await lines('Get-LocalGroupMember -Group Administrators|%{$_.Name}')).map(x => x.split('\\').pop().toLowerCase());
    return card(`<div class="hero"><div class="av" style="margin:0 auto 8px;width:64px;height:64px;font-size:26px">${SYS.fullName[0].toUpperCase()}</div><h3>${SYS.fullName}</h3><p>${SYS.username} · ${ad.includes(SYS.username.toLowerCase()) ? 'Admin' : 'Standard'}</p></div>`) + h2('Users') +
      card(us.map(l => { const [n, e] = l.split('|'); return row(n + (n.toLowerCase() === SYS.username.toLowerCase() ? ' (you)' : ''), (ad.includes(n.toLowerCase()) ? 'Admin' : 'Standard') + (/true/i.test(e) ? '' : ' · Disabled')); }).join('')) +
      h2('Manage') + card(row('Your info & picture', open('ms-settings:yourinfo')) + row('Add or remove users', btn('Add Account…', 'open', 'ms-settings:otherusers', 'p')));
  }
};

const WS = { tile: [0, 1] };
const ACTS = {
  open: (a) => call('open', a), launch: (a) => call('launch', a), rexp: () => restartExp(),
  async reg(a, e, on) { const [p, n, t, onV, offV] = dec(a); await call('reg:set', p, n, t, on ? onV : offV); if (p === EXP || p === SRCH) toast('Restart Explorer to apply', restartExp); },
  async regsel(a, e, v) { const [p, n, t] = dec(a); await call('reg:set', p, n, t, v); if (p === EXP || p === SRCH) toast('Restart Explorer to apply', restartExp); },
  async regrng(a, e, v) { const [p, n, t] = dec(a); await call('reg:set', p, n, t, v); toast('Sign out and back in to fully apply'); const s = e.closest('.row').querySelector('.s'); if (s) s.textContent = e.value + '%'; },
  async mode(a) { localStorage.setItem('mode', a); await call('theme:set', a); refresh(); },
  async accent(a) { localStorage.setItem('accent', a); document.documentElement.style.setProperty('--accent', a);
    const n = parseInt(a.slice(1), 16), abgr = (0xFF << 24 | (n & 255) << 16 | (n >> 8 & 255) << 8 | n >> 16) >>> 0;
    await call('reg:set', 'HKCU\\Software\\Microsoft\\Windows\\DWM', 'AccentColor', 'DWORD', abgr); refresh(); },
  async wifipw(a, e, on) { await call('wifi', 'power', on); refresh(); },
  wconn: async (a, e) => { e.textContent = '…'; await call('wifi', 'connect', a); setTimeout(() => refresh(), 2500); },
  wforget: async (a) => { await call('wifi', 'forget', a); refresh(); }, wdisc: async () => { await call('wifi', 'disconnect'); refresh(); },
  btset: async (a, e, on) => { await call('bt', 'set', on); refresh(); },
  fw: async (a, e, on) => { await call('launch', `netsh advfirewall set allprofiles state ${on ? 'on' : 'off'}`); refresh(); },
  vpn: async (a) => { const [n, s] = a.split('|'); await call('launch', s === 'Connected' ? `rasdial "${n}" /disconnect` : `rasdial "${n}"`); refresh(); },
  pw: (a, e, v) => call('power:set', a, v), vol: (a, e, v) => { call('vol', 'set', v); e.closest('.row').querySelector('.s').textContent = v + '%'; },
  mute: (a, e, on) => call('vol', 'mute', on), bright: (a, e, v) => { call('bright', 'set', v); e.closest('.row').querySelector('.s').textContent = v + '%'; },
  async wall() { const p = await call('pick'); if (p) { await call('reg:set', DESK, 'WallPaper', 'SZ', p); await call('wall', 'set', p); refresh(); } },
  async wstyle(a, e, v) { const [s, t] = v === 'tile' ? [0, 1] : [v, 0]; await call('reg:set', DESK, 'WallpaperStyle', 'SZ', s); await call('reg:set', DESK, 'TileWallpaper', 'SZ', t); const p = await rv(DESK, 'WallPaper'); if (p) await call('wall', 'set', p); refresh(); },
  async scr(a, e, v) { await call('reg:set', DESK, 'ScreenSaveActive', 'SZ', v ? 1 : 0); if (v) await call('reg:set', DESK, 'SCRNSAVE.EXE', 'SZ', v); },
  scrto: (a, e, v) => call('reg:set', DESK, 'ScreenSaveTimeOut', 'SZ', v * 60),
  scrprev: async () => { const p = await rv(DESK, 'SCRNSAVE.EXE'); call('launch', `"${p || 'C:\\Windows\\System32\\Mystify.scr'}" /s`); },
  dnd: (a, e, on) => call('reg:set', NOT, 'NOC_GLOBAL_SETTING_TOASTS_ENABLED', 'DWORD', on ? 0 : 1),
  quit: async (a) => { await call('ps', `(Get-Process -Id ${+a}).CloseMainWindow()|Out-Null`); setTimeout(() => refresh(), 800); },
  lock: () => call('launch', 'rundll32.exe user32.dll,LockWorkStation'),
  voice: (a, e, v) => call('reg:set', 'HKCU\\Software\\Microsoft\\Speech\\Voices', 'DefaultTokenId', 'SZ', v),
  speak: () => call('ps', "Add-Type -AssemblyName System.Speech;(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('Hello, this is a test of the selected voice.')")
};
const dispatch = (t, val) => { const f = ACTS[t.dataset.do]; if (f) f(t.dataset.arg, t, val); };
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-do]'); if (!t || ['SELECT', 'INPUT'].includes(t.tagName)) return;
  if (t.classList.contains('tg')) { t.classList.toggle('on'); dispatch(t, t.classList.contains('on')); } else dispatch(t);
});
document.addEventListener('change', (e) => { const t = e.target; if (t.dataset && t.dataset.do) dispatch(t, t.value); });

document.querySelectorAll('.tl').forEach(b => b.onclick = () => api.win(b.dataset.a));
$('#help').onclick = () => call('open', 'https://support.microsoft.com/windows');
$('#q').oninput = (e) => buildNav(e.target.value);
$('#back').onclick = () => { if (hist.length) { fwd.push(current); go(hist.pop(), false); } };
$('#fwd').onclick = () => { if (fwd.length) { hist.push(current); go(fwd.pop(), false); } };
(async () => {
  SYS = await call('sys:info');
  const a = localStorage.getItem('accent'); if (a) document.documentElement.style.setProperty('--accent', a);
  go('wifi', false); setTimeout(prefetch, 800);
  call('ps', '(Get-LocalUser -Name $env:USERNAME).FullName').then(n => { n = n.trim(); if (n) { SYS.fullName = n; buildNav($('#q').value); } });
})();
