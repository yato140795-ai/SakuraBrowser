const { app, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '256');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=384');

const AD_PATTERNS = [
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'google-analytics.com','googletagmanager.com','adservice.google.com',
  'connect.facebook.net','amazon-adsystem.com','adnxs.com','rubiconproject.com',
  'pubmatic.com','criteo.com','taboola.com','outbrain.com','quantserve.com',
  'scorecardresearch.com','moatads.com','an.yandex.ru','ads.yandex.ru',
  'mc.yandex.ru','adfox.ru','adriver.ru','/pagead/','/adserver/','/banner/'
];
function isAd(url){ const u = url.toLowerCase(); return AD_PATTERNS.some(p => u.includes(p)); }

function setupAdblock(){
  session.defaultSession.webRequest.onBeforeRequest({ urls:['*://*/*'] },
    (d, cb) => cb({ cancel: isAd(d.url) }));
}

const UI = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Sakura Browser</title>
<style>
:root{--bg-dark:#14162e;--bg-mid:#1e1f3f;--pink:#ff6eb4;--pink-glow:rgba(255,110,180,.6);--cyan:#5ee7ff;--text:#f0e9ff}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:'Segoe UI','Yu Gothic UI',sans-serif;color:var(--text)}
body{display:flex;flex-direction:column;background:var(--bg-dark)}
#titlebar{height:36px;background:linear-gradient(90deg,#1a1b3a,#2d1b4e,#1a1b3a);display:flex;align-items:center;-webkit-app-region:drag;border-bottom:1px solid rgba(255,110,180,.2);padding:0 8px}
#logo{font-size:15px;font-weight:600;padding-left:10px;background:linear-gradient(90deg,var(--pink),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
#logo::before{content:'🌸 ';-webkit-text-fill-color:initial}
.win-controls{margin-left:auto;display:flex;gap:2px;-webkit-app-region:no-drag}
.win-btn{width:40px;height:28px;border:none;background:transparent;color:var(--text);cursor:pointer;border-radius:6px;font-size:14px;transition:all .2s}
.win-btn:hover{background:rgba(255,110,180,.2)}.win-btn.close:hover{background:#e74c3c}
#toolbar{height:54px;background:linear-gradient(180deg,var(--bg-mid),var(--bg-dark));display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid rgba(255,110,180,.15)}
.nav-btn{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,110,180,.3);background:rgba(255,255,255,.04);color:var(--text);cursor:pointer;font-size:16px;transition:all .25s ease;display:flex;align-items:center;justify-content:center}
.nav-btn:hover{background:rgba(255,110,180,.15);border-color:var(--pink);box-shadow:0 0 16px var(--pink-glow);transform:translateY(-1px)}
.nav-btn:active{transform:scale(.92)}.nav-btn:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
#urlbar{flex:1;height:38px;background:rgba(255,255,255,.05);border:1px solid rgba(255,110,180,.3);border-radius:20px;padding:0 20px;color:var(--text);font-size:14px;outline:none;transition:all .25s}
#urlbar::placeholder{color:rgba(240,233,255,.4)}
#urlbar:focus{border-color:var(--pink);background:rgba(255,255,255,.08);box-shadow:0 0 20px rgba(255,110,180,.4)}
#webview-container{flex:1;position:relative;background:#0d0e1a}webview{width:100%;height:100%}
.sakura{position:fixed;top:-20px;pointer-events:none;font-size:18px;opacity:.6;animation:fall linear infinite;z-index:9999}
@keyframes fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(110vh) rotate(360deg)}}
</style></head><body>
<div id="titlebar"><div id="logo">Sakura Browser</div>
<div class="win-controls"><button class="win-btn" id="btn-min">−</button><button class="win-btn" id="btn-max">□</button><button class="win-btn close" id="btn-close">×</button></div></div>
<div id="toolbar">
<button class="nav-btn" id="btn-back">←</button><button class="nav-btn" id="btn-forward">→</button>
<button class="nav-btn" id="btn-reload">⟳</button><button class="nav-btn" id="btn-home">🏠</button>
<input id="urlbar" type="text" placeholder="Поиск или адрес..." value="https://www.google.com"/></div>
<div id="webview-container"><webview id="view" src="https://www.google.com" allowpopups></webview></div>
<script>
const { ipcRenderer } = require('electron');
const view=document.getElementById('view'),urlbar=document.getElementById('urlbar'),
btnBack=document.getElementById('btn-back'),btnForward=document.getElementById('btn-forward'),
btnReload=document.getElementById('btn-reload'),btnHome=document.getElementById('btn-home');
document.getElementById('btn-min').onclick=()=>ipcRenderer.send('win:min');
document.getElementById('btn-max').onclick=()=>ipcRenderer.send('win:max');
document.getElementById('btn-close').onclick=()=>ipcRenderer.send('win:close');
btnBack.onclick=()=>view.canGoBack()&&view.goBack();
btnForward.onclick=()=>view.canGoForward()&&view.goForward();
btnReload.onclick=()=>view.reload();
btnHome.onclick=()=>{view.loadURL('https://www.google.com');urlbar.value='https://www.google.com'};
function navigate(){let v=urlbar.value.trim();if(!v)return;
if(!/^[a-z]+:\/\//i.test(v)){if(/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v))v='https://'+v;else v='https://www.google.com/search?q='+encodeURIComponent(v)}
view.loadURL(v)}
urlbar.addEventListener('keydown',e=>{if(e.key==='Enter')navigate()});
view.addEventListener('did-navigate',e=>{urlbar.value=e.url;updateButtons()});
view.addEventListener('did-navigate-in-page',e=>{urlbar.value=e.url;updateButtons()});
function updateButtons(){btnBack.disabled=!view.canGoBack();btnForward.disabled=!view.canGoForward()}
for(let i=0;i<12;i++){const p=document.createElement('div');p.className='sakura';p.textContent='🌸';
p.style.left=Math.random()*100+'%';p.style.animationDuration=(8+Math.random()*8)+'s';
p.style.animationDelay=-Math.random()*10+'s';p.style.fontSize=(12+Math.random()*12)+'px';document.body.appendChild(p)}
</script></body></html>`;

function createWindow(){
  const win = new BrowserWindow({
    width:1280,height:800,minWidth:900,minHeight:600,
    frame:false,backgroundColor:'#14162e',show:false,
    webPreferences:{webviewTag:true,nodeIntegration:true,contextIsolation:false,backgroundThrottling:true,sandbox:false}
  });
  const tmp = path.join(app.getPath('userData'),'ui.html');
  fs.writeFileSync(tmp, UI, 'utf8');
  win.loadFile(tmp);
  win.once('ready-to-show',()=>win.show());
  ipcMain.on('win:min',()=>win.minimize());
  ipcMain.on('win:max',()=>win.isMaximized()?win.unmaximize():win.maximize());
  ipcMain.on('win:close',()=>win.close());
}

app.whenReady().then(()=>{
  setupAdblock();
  createWindow();
  app.on('activate',()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); });
});
app.on('window-all-closed',()=>{ if(process.platform!=='darwin') app.quit(); });
