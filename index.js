const { app, BrowserWindow, ipcMain, dialog } = require('electron')

ipcMain.on('get-user-data-path', (event) => {
    const userDataPath = app.getPath("userData");
    event.sender.send('user-data-path', userDataPath);
});

ipcMain.on("open-directory-dialog", function (event, response) {
  dialog
    .showOpenDialog({
      properties: ["openFile", "openDirectory"],
    })
    .then((result) => {
      event.sender.send(response, result.filePaths[0]);
    })
    .catch((err) => {
      console.log(err);
    });
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: "assets/animus-logo.png"
  })

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow()
});