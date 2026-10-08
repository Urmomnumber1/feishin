import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';

// Sour Player's mini player: shrinks the window to a small card that stays on top (where you last left
// it), then puts the window back the way it was (size, maximised, full screen).
interface Saved {
    bounds: Electron.Rectangle;
    fullScreen: boolean;
    maximized: boolean;
    minimum: number[];
    onTop: boolean;
}
let saved: null | Saved = null;
let miniBounds: Electron.Rectangle | null = null;
let closing = false;
const watched = new WeakSet<BrowserWindow>();

const shrink = (win: BrowserWindow) => {
    saved = {
        bounds: win.getNormalBounds(),
        fullScreen: win.isFullScreen(),
        maximized: win.isMaximized(),
        minimum: win.getMinimumSize(),
        onTop: win.isAlwaysOnTop(),
    };
    if (win.isFullScreen()) win.setFullScreen(false);
    if (win.isMaximized()) win.unmaximize();
    win.setMinimumSize(300, 120);
    if (miniBounds) win.setBounds(miniBounds);
    else win.setSize(400, 160);
    win.setAlwaysOnTop(true, 'floating');
};

const restore = (win: BrowserWindow) => {
    if (!saved) return;
    const { bounds, fullScreen, maximized, minimum, onTop } = saved;
    saved = null;
    win.setAlwaysOnTop(onTop);
    win.setMinimumSize(minimum[0], minimum[1]);
    win.setBounds(bounds);
    if (maximized) win.maximize();
    if (fullScreen) win.setFullScreen(true);
};

ipcMain.on('sour-mini', (event, on: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (on && !saved) {
        shrink(win);
        if (!watched.has(win)) {
            watched.add(win);
            // closing the app while it's small: put the full window back first, so the size the app
            // remembers for next time is the full one (this runs before the app saves it)
            win.prependListener('close', () => {
                closing = !!saved;
                restore(win);
            });
            // ...and when closing only hides it to the tray, it comes back as the mini player
            win.on('close', (closeEvent) => {
                if (!closing) return;
                closing = false;
                if (closeEvent.defaultPrevented && !win.isDestroyed()) shrink(win);
            });
        }
    } else if (!on && saved) {
        miniBounds = win.getBounds();
        restore(win);
    }
});

// Sour Player icon packs and holiday icons: the app draws the icon and the window shows it
ipcMain.on('sour-icon', (event, data: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || typeof data !== 'string' || !data.startsWith('data:image/png;base64,')) return;
    if (data.length > 2_000_000) return;
    const image = nativeImage.createFromDataURL(data);
    if (image.isEmpty()) return;
    win.setIcon(image);
    if (process.platform === 'darwin') app.dock?.setIcon(image);
});
