const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

let mainWindow = null;
let serverPort = 3000;
let dataDir = '';
let cleanUserAgent = '';

app.setName('StyleSync');

function getCleanChromeUserAgent(rawUa) {
  return String(rawUa || '')
    .replace(/\s*Electron\/[^\s]+/gi, '')
    .replace(/\s*StyleSync\/[^\s]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function findAvailablePort(preferredPort) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : preferredPort;
        fallback.close(() => resolve(port));
      });
    });
    tester.listen(preferredPort, () => {
      const addr = tester.address();
      const port = typeof addr === 'object' && addr ? addr.port : preferredPort;
      tester.close(() => resolve(port));
    });
  });
}

function waitForServerHealth(port, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          reject(new Error('Embedded StyleSync server returned an error status.'));
        } else {
          setTimeout(check, 150);
        }
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Timed out waiting for embedded StyleSync server to start.'));
        } else {
          setTimeout(check, 150);
        }
      });
      req.setTimeout(1500, () => req.destroy());
    };
    check();
  });
}

async function startEmbeddedServer() {
  const appRoot = path.resolve(__dirname, '..');
  dataDir = path.join(app.getPath('userData'), 'stylesync-data');
  fs.mkdirSync(dataDir, { recursive: true });

  serverPort = await findAvailablePort(Number(process.env.PORT || 3000));
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(serverPort);
  process.env.STYLESYNC_HOST = 'dual';
  process.env.STYLESYNC_APP_DIR = appRoot;
  process.env.STYLESYNC_DATA_DIR = dataDir;

  const bundledServer = path.join(appRoot, 'dist-server', 'server.cjs');
  if (fs.existsSync(bundledServer)) {
    require(bundledServer);
  } else {
    await import(path.join(appRoot, 'server.ts'));
  }

  await waitForServerHealth(serverPort);
}

function isAllowedPopupUrl(url) {
  if (!url || url === 'about:blank' || url.startsWith('about:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'accounts.google.com' ||
      host.endsWith('.google.com') ||
      host.endsWith('.googleapis.com') ||
      host.endsWith('.gstatic.com') ||
      host.endsWith('.firebaseapp.com') ||
      host.endsWith('.web.app')
    );
  } catch {
    return false;
  }
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Open Wardrobe Data Folder',
                click: () => {
                  if (dataDir) void shell.openPath(dataDir);
                },
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Wardrobe Data Folder',
          click: () => {
            if (dataDir) void shell.openPath(dataDir);
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'StyleSync — AI Digital Wardrobe',
    backgroundColor: '#F7F3ED',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (cleanUserAgent) {
    mainWindow.webContents.setUserAgent(cleanUserAgent);
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          autoHideMenuBar: true,
          backgroundColor: '#FFFFFF',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      };
    }
    if (url && /^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWindow) => {
    if (cleanUserAgent) {
      childWindow.webContents.setUserAgent(cleanUserAgent);
    }
    childWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedPopupUrl(url)) {
        return { action: 'allow' };
      }
      if (url && /^https?:\/\//i.test(url)) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('stylesync:get-desktop-info', () => ({
  isElectron: true,
  platform: process.platform,
  appVersion: app.getVersion(),
  dataDir,
}));

ipcMain.handle('stylesync:open-data-folder', async () => {
  if (!dataDir) return { ok: false };
  const err = await shell.openPath(dataDir);
  return { ok: !err, error: err || undefined };
});

ipcMain.handle('stylesync:open-external-url', async (_event, targetUrl) => {
  try {
    const parsed = new URL(String(targetUrl || ''));
    const isAllowed =
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'));
    if (!isAllowed) {
      return { ok: false, error: 'Unsupported URL scheme.' };
    }
    await shell.openExternal(parsed.toString());
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('stylesync:focus-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return { ok: true };
});

app.whenReady().then(async () => {
  try {
    cleanUserAgent = getCleanChromeUserAgent(app.userAgentFallback);
    if (cleanUserAgent) {
      app.userAgentFallback = cleanUserAgent;
      session.defaultSession.setUserAgent(cleanUserAgent);
    }
    session.defaultSession.webRequest.onBeforeSendHeaders(
      {
        urls: [
          'https://accounts.google.com/*',
          'https://*.google.com/*',
          'https://*.googleapis.com/*',
          'https://*.firebaseapp.com/*',
        ],
      },
      (details, callback) => {
        const headers = { ...details.requestHeaders };
        if (cleanUserAgent) {
          headers['User-Agent'] = cleanUserAgent;
        }
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase().startsWith('sec-ch-ua') && typeof headers[key] === 'string') {
            headers[key] = headers[key]
              .replace(/"(Electron|StyleSync)"[^,]*,?\s*/gi, '')
              .replace(/^,\s*|,\s*$/g, '');
          }
        }
        callback({ requestHeaders: headers });
      }
    );
    buildAppMenu();
    await startEmbeddedServer();
    createWindow();
  } catch (err) {
    dialog.showErrorBox(
      'StyleSync Failed to Start',
      err instanceof Error ? err.message : String(err)
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
