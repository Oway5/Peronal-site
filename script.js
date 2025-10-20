const workspace = document.getElementById('workspace');
const addWindowBtn = document.getElementById('add-window-btn');

let windows = [];
let windowCounter = 0;
let gapPercentX = 0;
let gapPercentY = 0;

const colors = [
    '#f7768e', '#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', 
    '#7dcfff', '#ff9e64', '#db4b4b'
];

function calculateGapPercentages() {
    const style = getComputedStyle(document.documentElement);
    const gapPx = parseFloat(style.getPropertyValue('--gap')) || 0;

    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;

    if (workspaceWidth > 0) {
        gapPercentX = (gapPx / workspaceWidth) * 100;
    }
    if (workspaceHeight > 0) {
        gapPercentY = (gapPx / workspaceHeight) * 100;
    }
}

function createWindowElement() {
    const windowEl = document.createElement('div');
    windowEl.className = 'window new';
    windowEl.textContent = ++windowCounter;
    windowEl.style.borderColor = colors[windowCounter % colors.length];
    workspace.appendChild(windowEl);
    return windowEl;
}

function updateWindowLayout() {
    windows.forEach(win => {
        const el = win.element;
        if (el.classList.contains('new')) {
            const delay = windows.length > 1 ? 150 : 0;
            setTimeout(() => {
                el.classList.remove('new');
            }, delay);
        }
        el.style.top = `${win.y}%`;
        el.style.left = `${win.x}%`;
        el.style.width = `${win.width}%`;
        el.style.height = `${win.height}%`;
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
            windowToSplit = candidateWindows[Math.floor(Math.random() * candidateWindows.length)];
        } else {
            windowToSplit = windows.reduce((largest, current) => {
                return (current.width * current.height > largest.width * largest.height) ? current : largest;
            }, windows[0]);
        }
        
        const newWindowEl = createWindowElement();
        const newWindow = {
            id: windowCounter,
            element: newWindowEl,
            splitCount: 0,
        };

        let splitSuccess = false;
        const splitPreference = (windowToSplit.width > windowToSplit.height * 0.75);
        
        if (windows.length >= 4 ? splitPreference : (windowToSplit.width > windowToSplit.height)) {
            splitSuccess = splitVertically(windowToSplit, newWindow);
        } else {
            splitSuccess = splitHorizontally(windowToSplit, newWindow);
        }

        if (!splitSuccess) {
            windowCounter--;
            workspace.removeChild(newWindowEl);
            return;
        }

        windowToSplit.splitCount++;
        newWindow.splitCount = windowToSplit.splitCount;
        windows.push(newWindow);
    }
    updateWindowLayout();
}

function splitVertically(windowToSplit, newWindow) {
    const originalWidth = windowToSplit.width;
    const newWidth = (originalWidth - gapPercentX) / 2;

    if (newWidth < 1) return false;

    windowToSplit.width = newWidth;
    newWindow.width = newWidth;
    newWindow.height = windowToSplit.height;
    newWindow.x = windowToSplit.x + newWidth + gapPercentX;
    newWindow.y = windowToSplit.y;
    return true;
}

function splitHorizontally(windowToSplit, newWindow) {
    const originalHeight = windowToSplit.height;
    const newHeight = (originalHeight - gapPercentY) / 2;

    if (newHeight < 1) return false;

    windowToSplit.height = newHeight;
    newWindow.width = windowToSplit.width;
    newWindow.height = newHeight;
    newWindow.x = windowToSplit.x;
    newWindow.y = windowToSplit.y + newHeight + gapPercentY;
    return true;
}

document.body.addEventListener('click', addNewWindow);

calculateGapPercentages();
addNewWindow();

const resizeObserver = new ResizeObserver(() => {
    calculateGapPercentages();
    updateWindowLayout();
});
resizeObserver.observe(workspace);
