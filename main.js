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

// ==================== СТАРТОВАЯ СТРАНИЦА ====================
const START_PAGE = `data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Новая вкладка</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;600&display=swap');
  body {
    margin: 0; height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif;
    background: url('https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1920&auto=format&fit=crop') no-repeat center center fixed;
    background-size: cover; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.8);
  }
  .glass {
    background: rgba(20, 22, 46, 0.4); backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 110, 180, 0.3); border-radius: 24px;
    padding: 40px 60px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  h1 { font-weight: 300; font-size: 48px; margin-bottom: 10px; letter-spacing: 2px; }
  #clock { font-size: 80px; font-weight: 600; color: #ff6eb4; margin: 0; text-shadow: 0 0 20px rgba(255,110,180,0.5); }
  .search-box { margin-top: 30px; position: relative; }
  input {
    width: 400px; padding: 15px 25px; border-radius: 30px; border: 2px solid rgba(255,110,180,0.5);
    background: rgba(255,255,255,0.1); color: white; font-size: 18px; outline: none; transition: 0.3s;
  }
  input:focus { border-color: #ff6eb4; background: rgba(255,255,255,0.2); box-shadow: 0 0 20px rgba(255,110,180,0.4); }
  input::placeholder { color: rgba(255,255,255,0.6); }
</style>
</head>
<body>
  <div class="glass">
    <h1>Добро пожаловать</h1>
    <div id="clock">00:00</div>
    <div class="search-box">
      <input type="text" id="search" placeholder="Поиск в интернете..." autofocus>
    </div>
  </div>
  <script>
    function updateClock() {
      const now = new Date();
      document.getElementById('clock').innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    }
    setInterval(updateClock, 1000); updateClock();
    
    document.getElementById('search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(e.target.value);
      }
    });
  </script>
</body>
</html>
`)}`;

// ==================== ИНТЕРФЕЙС БРАУЗЕРА ====================
const UI = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Sakura Browser</title>
<style>
:root{--bg-dark:#14162e;--bg-glass:rgba(20,22,46,0.6);--pink:#ff6eb4;--pink-glow:rgba(255,110,180,.6);--cyan:#5ee7ff;--text:#f0e9ff}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:'Segoe UI',sans-serif;color:var(--text)}
body{display:flex;flex-direction:column;background:var(--bg-dark);}

/* Верхняя панель (заголовок окна) */
#titlebar{height:36px;background:var(--bg-glass);backdrop-filter:blur(10px);display:flex;align-items:center;-webkit-app-region:drag;border-bottom:1px solid rgba(255,110,180,.15);padding:0 8px;z-index:10}
#logo{font-size:14px;font-weight:600;padding-left:10px;background:linear-gradient(90deg,var(--pink),var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;pointer-events:none;letter-spacing:1px}
#logo::before{content:'🌸 ';-webkit-text-fill-color:initial}
.win-controls{margin-left:auto;display:flex;gap:2px;-webkit-app-region:no-drag}
.win-btn{width:40px;height:28px;border:none;background:transparent;color:var(--text);cursor:pointer;border-radius:6px;font-size:14px;transition:all .2s;-webkit-app-region:no-drag}
.win-btn:hover{background:rgba(255,110,180,.3)}.win-btn.close:hover{background:#e74c3c}

/* Панель инструментов (навигация) */
#toolbar{height:52px;background:var(--bg-glass);backdrop-filter:blur(10px);display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid rgba(255,110,180,.15);-webkit-app-region:no-drag;z-index:10}
.nav-btn{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,110,180,.2);background:rgba(255,255,255,.05);color:var(--text);cursor:pointer;font-size:16px;transition:all .25s ease;display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag}
.nav-btn:hover{background:rgba(255,110,180,.2);border-color:var(--pink);box-shadow:0 0 12px var(--pink-glow);transform:translateY(-1px)}
.nav-btn:active{transform:scale(.92)}.nav-btn:disabled{opacity:.3;cursor:not-allowed;box-shadow:none;background:transparent}
#urlbar{flex:1;height:36px;background:rgba(0,0,0,.2);border:1px solid rgba(255,110,180,.2);border-radius:18px;padding:0 20px;color:var(--text);font-size:13px;outline:none;transition:all .25s;-webkit-app-region:no-drag}
#urlbar:focus{border-color:var(--pink);background:rgba(0,0,0,.4);box-shadow:0 0 15px rgba(255,110,180,.3)}

/* Контент */
#webview-container{flex:1;position:relative;background:#0d0e1a}
webview{width:100%;height:100%}

/* Лепестки */
.sakura{position:fixed;top:-20px;pointer-events:none;font-size:18px;opacity:.7;animation:fall linear infinite;z-index:9999}
@keyframes fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(110vh) rotate(360deg)}}
</style></head><body>

<div id="titlebar">
  <div id="logo">Sakura Browser</div>
  <div class="win-controls">
    <button class="win-btn" id="btn-min">−</button>
    <button class="win-btn" id="btn-max">□</button>
    <button class="win-btn close" id="btn-close">×</button>
  </div>
</div>

<div id="toolbar">
  <button class="nav-btn" id="btn-back">←</button>
  <button class="nav-btn" id="btn-forward">→</button>
  <button class="nav-btn" id="btn-reload">⟳</button>
  <button class="nav-btn" id="btn-home">🏠</button>
  <input id="urlbar" type="text" placeholder="Введите адрес или поисковый запрос..." value=""/>
</div>

<div id="webview-container">
  <webview id="view" src="${START_PAGE}" allowpopups></webview>
</div>

<script>
const { ipcRenderer } = require('electron');
const view=document.getElementById('view'),urlbar=document.getElementById('urlbar'),
btnBack=document.getElementById('btn-back'),btnForward=document.getElementById('btn-forward'),
btnReload=document.getElementById('btn-reload'),btnHome=document.getElementById('btn-home');

document.getElementById('btn-min').onclick=()=>ipcRenderer.send('win:min');
document.getElementById('btn-max').onclick=()=>ipcRenderer.send('win:max');
document.getElementById('btn-close').onclick=()=>ipcRenderer.send('win:close');

btnBack.onclick=()=>{if(view.canGoBack())view.goBack()};
btnForward.onclick=()=>{if(view.canGoForward())view.goForward()};
btnReload.onclick=()=>view.reload();
btnHome.onclick=()=>{view.loadURL('${START_PAGE}'); urlbar.value=''};

function navigate(){
  let v=urlbar.value.trim();
  if(!v)return;
  if(!/^[a-z]+:\/\//i.test(v)){
    if(/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v))v='https://'+v;
    else v='https://www.google.com/search?q='+encodeURIComponent(v);
  }
  view.loadURL(v);
}
urlbar.addEventListener('keydown',e=>{if(e.key==='Enter')navigate()});

// Обновление адресной строки при переходах
view.addEventListener('dom-ready',()=>{ if(!view.getURL().startsWith('data:')) urlbar.value=view.getURL(); updateButtons(); });
view.addEventListener('did-navigate',e=>{ if(!e.url.startsWith('data:')) urlbar.value=e.url; updateButtons(); });
view.addEventListener('did-navigate-in-page',e=>{ if(!e.url.startsWith('data:')) urlbar.value=e.url; updateButtons(); });

function updateButtons(){
  btnBack.disabled=!view.canGoBack();
  btnForward.disabled=!view.canGoForward();
}

// Лепестки сакуры
for(let i=0;i<15;i++){
  const p=document.createElement('div');p.className='sakura';p.textContent='🌸';
  p.style.left=Math.random()*100+'%';p.style.animationDuration=(10+Math.random()*10)+'s';
  p.style.animationDelay=-Math.random()*15+'s';p.style.fontSize=(10+Math.random()*12)+'px';
  document.body.appendChild(p);
}
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
