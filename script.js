const workspace = document.getElementById('workspace');
const addWindowBtn = document.getElementById('add-window-btn');

let windows = [];
let windowCounter = 0;

const colors = [
    '#f7768e', '#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', 
    '#7dcfff', '#ff9e64', '#db4b4b'
];

function createWindowElement() {
    const windowEl = document.createElement('div');
    windowEl.className = 'window';
    windowEl.textContent = ++windowCounter;
    windowEl.style.borderColor = colors[windowCounter % colors.length];
    workspace.appendChild(windowEl);
    return windowEl;
}

function updateWindowLayout() {
    windows.forEach(win => {
        win.element.style.top = `${win.y}%`;
        win.element.style.left = `${win.x}%`;
        win.element.style.width = `${win.width}%`;
        win.element.style.height = `${win.height}%`;
    });
}

function addNewWindow() {
    if (windows.length === 0) {
        const newWindow = {
            id: windowCounter,
            element: createWindowElement(),
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            splitCount: 0
        };
        windows.push(newWindow);
    } else {
        let windowToSplit;

        if (windows.length >= 4) {
            const minSplitCount = Math.min(...windows.map(w => w.splitCount));
            const candidateWindows = windows.filter(w => w.splitCount === minSplitCount);
            const randomIndex = Math.floor(Math.random() * candidateWindows.length);
            windowToSplit = candidateWindows[randomIndex];
        } else {
            windowToSplit = windows.reduce((largest, current) => {
                return (current.width * current.height > largest.width * largest.height) ? current : largest;
            }, windows[0]);
        }
        
        const newWindowEl = createWindowElement();
        windowToSplit.splitCount++;
        
        const newWindow = {
            id: windowCounter,
            element: newWindowEl,
            splitCount: windowToSplit.splitCount,
        };

        // Decide split direction based on the number of windows
        if (windows.length >= 4) {
            // After 4 windows, prefer vertical splits.
            // Split vertically unless the window is substantially taller than it is wide.
            if (windowToSplit.width > windowToSplit.height * 0.75) { 
                splitVertically(windowToSplit, newWindow);
            } else { // Split horizontally
                splitHorizontally(windowToSplit, newWindow);
            }
        } else {
            // Original logic for less than 4 windows
            if (windowToSplit.width > windowToSplit.height) { // Split vertically
                splitVertically(windowToSplit, newWindow);
            } else { // Split horizontally
                splitHorizontally(windowToSplit, newWindow);
            }
        }
        windows.push(newWindow);
    }
    updateWindowLayout();
}

function splitVertically(windowToSplit, newWindow) {
    newWindow.width = windowToSplit.width / 2;
    newWindow.height = windowToSplit.height;
    newWindow.x = windowToSplit.x + windowToSplit.width / 2;
    newWindow.y = windowToSplit.y;
    windowToSplit.width /= 2;
}

function splitHorizontally(windowToSplit, newWindow) {
    newWindow.width = windowToSplit.width;
    newWindow.height = windowToSplit.height / 2;
    newWindow.x = windowToSplit.x;
    newWindow.y = windowToSplit.y + windowToSplit.height / 2;
    windowToSplit.height /= 2;
}

document.body.addEventListener('click', addNewWindow);
// Add the first window automatically
addNewWindow();
