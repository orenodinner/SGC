import path from "node:path";
import { app, BrowserWindow } from "electron";
import { DatabaseManager } from "../infra/db/database";
import { registerIpcHandlers } from "./ipc";
import { WorkspaceService } from "./services/workspace-service";

let mainWindow: BrowserWindow | null = null;

async function bootstrap(): Promise<void> {
  const dataDir = path.join(app.getPath("userData"), "data");
  const dbPath = path.join(dataDir, "sgc.sqlite");
  const database = new DatabaseManager(dbPath);
  await database.initialize();
  registerIpcHandlers(new WorkspaceService(database));

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f5efe2",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  void bootstrap();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void bootstrap();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
