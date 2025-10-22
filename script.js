const workspace = document.getElementById('workspace');
const themeSwitcher = document.getElementById('theme-switcher');

const themes = ['tokyo-night', 'catppuccin', 'gruvbox', 'rose-pine'];
let currentThemeIndex = 0;

function applyTheme() {
    document.body.dataset.theme = themes[currentThemeIndex];
}

themeSwitcher.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme();
});

applyTheme();

let layoutRoot = null;
let windowCounter = 0;
let gapPercentX = 0;
let gapPercentY = 0;

const windowsById = new Map();
const CLOSE_ANIMATION_MS = 180;
const DEFAULT_SPLIT_RATIO = 0.5;

function calculateGapPercentages() {
    const style = getComputedStyle(document.documentElement);
    const gapPx = parseFloat(style.getPropertyValue('--gap')) || 0;

    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;

    gapPercentX = workspaceWidth > 0 ? (gapPx / workspaceWidth) * 100 : 0;
    gapPercentY = workspaceHeight > 0 ? (gapPx / workspaceHeight) * 100 : 0;
}

function clampPercentage(value) {
    return Number(Math.max(0, value).toFixed(4));
}

function createWindowElement(id) {
    const windowEl = document.createElement('div');
    windowEl.className = 'window new';
    windowEl.classList.add(`color-${(id % 8) + 1}`);
    windowEl.dataset.windowId = String(id);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'window-close';
    closeButton.setAttribute('aria-label', `Close window ${id}`);
    closeButton.title = 'Close window';
    closeButton.innerHTML = `
        <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
        </svg>
    `;
    closeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeWindow(id);
    });

    windowEl.append(closeButton);
    workspace.appendChild(windowEl);

    return windowEl;
}

function createLeaf(windowData) {
    return {
        type: 'leaf',
        windowData,
        parent: null,
        splitCount: 0,
        cachedRect: {
            x: 0,
            y: 0,
            width: 100,
            height: 100
        }
    };
}

function selectLeafToSplit() {
    const leaves = Array.from(windowsById.values());
    if (leaves.length === 0) {
        return null;
    }
    if (leaves.length === 1) {
        return leaves[0];
    }

    if (leaves.length >= 4) {
        const minSplitCount = Math.min(...leaves.map(leaf => leaf.splitCount));
        const candidates = leaves.filter(leaf => leaf.splitCount === minSplitCount);
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    return leaves.reduce((largest, current) => {
        const largestArea = largest.cachedRect.width * largest.cachedRect.height;
        const currentArea = current.cachedRect.width * current.cachedRect.height;

        if (currentArea === largestArea) {
            return current.splitCount < largest.splitCount ? current : largest;
        }
        return currentArea > largestArea ? current : largest;
    });
}

function determineSplitOrientation(leaf) {
    const rect = leaf.cachedRect;
    const preferVertical = windowsById.size >= 4
        ? rect.width > rect.height * 0.75
        : rect.width > rect.height;
    return preferVertical ? 'vertical' : 'horizontal';
}

function splitLeaf(targetLeaf, newLeaf, orientation) {
    const parent = targetLeaf.parent;
    const splitNode = {
        type: 'split',
        orientation,
        ratio: DEFAULT_SPLIT_RATIO,
        first: targetLeaf,
        second: newLeaf,
        parent
    };

    targetLeaf.parent = splitNode;
    targetLeaf.splitCount += 1;

    newLeaf.parent = splitNode;
    newLeaf.splitCount = targetLeaf.splitCount;

    if (!parent) {
        layoutRoot = splitNode;
    } else if (parent.first === targetLeaf) {
        parent.first = splitNode;
    } else {
        parent.second = splitNode;
    }
}

function removeLeafFromTree(leaf) {
    const parent = leaf.parent;
    if (!parent) {
        layoutRoot = null;
        return;
    }

    const sibling = parent.first === leaf ? parent.second : parent.first;
    const grandParent = parent.parent;

    sibling.parent = grandParent || null;

    if (!grandParent) {
        layoutRoot = sibling;
        return;
    }

    if (grandParent.first === parent) {
        grandParent.first = sibling;
    } else {
        grandParent.second = sibling;
    }
}

function applyLayout(node, rect) {
    if (!node) {
        return;
    }

    if (node.type === 'leaf') {
        node.cachedRect = rect;
        const { element } = node.windowData;

        if (!element) {
            return;
        }

        element.style.top = `${rect.y}%`;
        element.style.left = `${rect.x}%`;
        element.style.width = `${rect.width}%`;
        element.style.height = `${rect.height}%`;

        if (element.classList.contains('new')) {
            const delay = windowsById.size > 1 ? 150 : 0;
            setTimeout(() => {
                element.classList.remove('new');
            }, delay);
        }
        return;
    }

    const { orientation, ratio, first, second } = node;

    if (orientation === 'vertical') {
        const usableWidth = Math.max(rect.width - gapPercentX, 0);
        const firstWidth = clampPercentage(usableWidth * ratio);
        const secondWidth = clampPercentage(usableWidth - firstWidth);

        applyLayout(first, {
            x: rect.x,
            y: rect.y,
            width: firstWidth,
            height: rect.height
        });

        applyLayout(second, {
            x: rect.x + firstWidth + gapPercentX,
            y: rect.y,
            width: secondWidth,
            height: rect.height
        });
    } else {
        const usableHeight = Math.max(rect.height - gapPercentY, 0);
        const firstHeight = clampPercentage(usableHeight * ratio);
        const secondHeight = clampPercentage(usableHeight - firstHeight);

        applyLayout(first, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: firstHeight
        });

        applyLayout(second, {
            x: rect.x,
            y: rect.y + firstHeight + gapPercentY,
            width: rect.width,
            height: secondHeight
        });
    }
}

function updateWindowLayout() {
    calculateGapPercentages();
    if (!layoutRoot) {
        return;
    }

    applyLayout(layoutRoot, {
        x: 0,
        y: 0,
        width: 100,
        height: 100
    });
}

function addNewWindow() {
    const id = ++windowCounter;
    const element = createWindowElement(id);

    const newLeaf = createLeaf({ id, element });

    if (!layoutRoot) {
        layoutRoot = newLeaf;
    } else {
        const targetLeaf = selectLeafToSplit();
        if (targetLeaf) {
            const orientation = windowsById.size === 1
                ? 'vertical'
                : determineSplitOrientation(targetLeaf);
            splitLeaf(targetLeaf, newLeaf, orientation);
        } else {
            layoutRoot = newLeaf;
        }
    }

    windowsById.set(id, newLeaf);
    updateWindowLayout();
}

function closeWindow(windowId) {
    const leaf = windowsById.get(windowId);
    if (!leaf) {
        return;
    }

    const { element } = leaf.windowData;
    if (!element || element.classList.contains('closing')) {
        return;
    }

    element.classList.add('closing');
    element.style.pointerEvents = 'none';

    let removed = false;
    const finalizeRemoval = () => {
        if (removed) {
            return;
        }
        removed = true;
        if (element.parentElement === workspace) {
            workspace.removeChild(element);
        }
    };

    element.addEventListener('transitionend', finalizeRemoval, { once: true });
    element.addEventListener('transitioncancel', finalizeRemoval, { once: true });
    setTimeout(finalizeRemoval, CLOSE_ANIMATION_MS * 3);

    removeLeafFromTree(leaf);
    windowsById.delete(windowId);

    updateWindowLayout();
}

document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
        return;
    }
    if (event.target.closest('.window-close')) {
        return;
    }
    addNewWindow();
});

calculateGapPercentages();
addNewWindow();

const resizeObserver = new ResizeObserver(() => {
    calculateGapPercentages();
    updateWindowLayout();
});
resizeObserver.observe(workspace);
