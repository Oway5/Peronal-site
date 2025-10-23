// Base Window Management Logic
// Handles window creation, layout, tiling, resizing, and closing
//
// PUBLIC API FOR WINDOW CREATION:
// - addNewWindow() - Creates a new window using automatic target selection
// - addNewWindowTargeted(targetWindowId, orientation) - Creates a new window by splitting a specific window
//   * targetWindowId: number|null - The ID of the window to split (null for automatic)
//   * orientation: 'vertical'|'horizontal'|null - Split direction (null for automatic)
// - splitWindowVertical(targetWindowId) - Split a specific window vertically
// - splitWindowHorizontal(targetWindowId) - Split a specific window horizontally
// - getAllWindowIds() - Returns array of all current window IDs
// - getWindowLeaf(windowId) - Returns the leaf node for a specific window
// - closeWindow(windowId) - Closes a specific window
// - resetToHome() - Closes all windows and creates a fresh first window
//
// EXAMPLE USAGE:
// addNewWindow();                          // Add window with automatic selection
// addNewWindowTargeted(1, 'vertical');     // Split window 1 vertically
// splitWindowHorizontal(2);                // Split window 2 horizontally
// const ids = getAllWindowIds();           // Get all window IDs [1, 2, 3, ...]

const workspace = document.getElementById('workspace');

let layoutRoot = null;
let windowCounter = 0;
let gapPercentX = 0;
let gapPercentY = 0;

const windowsById = new Map();
const CLOSE_ANIMATION_MS = 180;
const DEFAULT_SPLIT_RATIO = 0.5;

// Resize state
let resizingNode = null;
let resizeStartPos = { x: 0, y: 0 };
let resizeStartRatio = 0;

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

function createResizeHandle(splitNode) {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${splitNode.orientation}`;
    handle.dataset.splitNodeId = splitNode.id;
    
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startResize(splitNode, e);
    });
    
    workspace.appendChild(handle);
    return handle;
}

function splitLeaf(targetLeaf, newLeaf, orientation) {
    const parent = targetLeaf.parent;
    const splitNode = {
        type: 'split',
        orientation,
        ratio: DEFAULT_SPLIT_RATIO,
        first: targetLeaf,
        second: newLeaf,
        parent,
        id: `split-${Date.now()}-${Math.random()}`,
        resizeHandle: null
    };

    // Create resize handle for this split
    splitNode.resizeHandle = createResizeHandle(splitNode);

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

    // Clean up the parent's resize handle
    if (parent.resizeHandle && parent.resizeHandle.parentElement === workspace) {
        workspace.removeChild(parent.resizeHandle);
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

    const { orientation, ratio, first, second, resizeHandle } = node;

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

        // Position resize handle
        if (resizeHandle) {
            const handleX = rect.x + firstWidth;
            resizeHandle.style.left = `${handleX}%`;
            resizeHandle.style.top = `${rect.y}%`;
            resizeHandle.style.width = `${gapPercentX}%`;
            resizeHandle.style.height = `${rect.height}%`;
        }
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

        // Position resize handle
        if (resizeHandle) {
            const handleY = rect.y + firstHeight;
            resizeHandle.style.left = `${rect.x}%`;
            resizeHandle.style.top = `${handleY}%`;
            resizeHandle.style.width = `${rect.width}%`;
            resizeHandle.style.height = `${gapPercentY}%`;
        }
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

/**
 * Add a new window by splitting a specific target window
 * @param {number|null} targetWindowId - The ID of the window to split. If null, uses automatic selection.
 * @param {string|null} orientation - 'vertical' or 'horizontal'. If null, determines automatically.
 * @returns {number} The ID of the newly created window
 */
function addNewWindowTargeted(targetWindowId = null, orientation = null) {
    const id = ++windowCounter;
    const element = createWindowElement(id);

    const newLeaf = createLeaf({ id, element });

    if (!layoutRoot) {
        // First window - no splitting needed
        layoutRoot = newLeaf;
    } else {
        let targetLeaf;
        
        if (targetWindowId !== null) {
            // Split a specific window
            targetLeaf = windowsById.get(targetWindowId);
            if (!targetLeaf) {
                console.warn(`Window ${targetWindowId} not found, using automatic selection`);
                targetLeaf = selectLeafToSplit();
            }
        } else {
            // Use automatic selection
            targetLeaf = selectLeafToSplit();
        }

        if (targetLeaf) {
            // Determine orientation
            let splitOrientation;
            if (orientation !== null && (orientation === 'vertical' || orientation === 'horizontal')) {
                splitOrientation = orientation;
            } else if (windowsById.size === 1) {
                splitOrientation = 'vertical';
            } else {
                splitOrientation = determineSplitOrientation(targetLeaf);
            }
            
            splitLeaf(targetLeaf, newLeaf, splitOrientation);
        } else {
            layoutRoot = newLeaf;
        }
    }

    windowsById.set(id, newLeaf);
    updateWindowLayout();
    
    return id;
}

/**
 * Add a new window using automatic selection (convenience function)
 * @returns {number} The ID of the newly created window
 */
function addNewWindow() {
    return addNewWindowTargeted(null, null);
}

/**
 * Split a specific window vertically
 * @param {number} targetWindowId - The ID of the window to split
 * @returns {number} The ID of the newly created window
 */
function splitWindowVertical(targetWindowId) {
    return addNewWindowTargeted(targetWindowId, 'vertical');
}

/**
 * Split a specific window horizontally
 * @param {number} targetWindowId - The ID of the window to split
 * @returns {number} The ID of the newly created window
 */
function splitWindowHorizontal(targetWindowId) {
    return addNewWindowTargeted(targetWindowId, 'horizontal');
}

/**
 * Get all current window IDs
 * @returns {number[]} Array of window IDs
 */
function getAllWindowIds() {
    return Array.from(windowsById.keys());
}

/**
 * Get the leaf node for a specific window ID
 * @param {number} windowId - The window ID
 * @returns {object|null} The leaf node or null if not found
 */
function getWindowLeaf(windowId) {
    return windowsById.get(windowId) || null;
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

function startResize(splitNode, event) {
    resizingNode = splitNode;
    resizeStartPos = { x: event.clientX, y: event.clientY };
    resizeStartRatio = splitNode.ratio;
    
    document.body.style.cursor = splitNode.orientation === 'vertical' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function doResize(event) {
    if (!resizingNode) return;
    
    const workspaceRect = workspace.getBoundingClientRect();
    const deltaX = event.clientX - resizeStartPos.x;
    const deltaY = event.clientY - resizeStartPos.y;
    
    let deltaRatio = 0;
    
    if (resizingNode.orientation === 'vertical') {
        // Calculate the parent rect to get the actual width this split occupies
        const parentRect = getNodeRect(resizingNode);
        const actualWidth = workspaceRect.width * (parentRect.width / 100);
        deltaRatio = deltaX / actualWidth;
    } else {
        const parentRect = getNodeRect(resizingNode);
        const actualHeight = workspaceRect.height * (parentRect.height / 100);
        deltaRatio = deltaY / actualHeight;
    }
    
    // Apply the new ratio with constraints
    let newRatio = resizeStartRatio + deltaRatio;
    newRatio = Math.max(0.1, Math.min(0.9, newRatio)); // Constrain between 10% and 90%
    
    resizingNode.ratio = newRatio;
    updateWindowLayout();
}

function stopResize() {
    resizingNode = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
}

function getNodeRect(node) {
    // Walk up the tree to find the rect this node occupies
    if (!node.parent) {
        return { x: 0, y: 0, width: 100, height: 100 };
    }
    
    const parentRect = getNodeRect(node.parent);
    const { orientation, ratio, first } = node.parent;
    
    if (node.parent.first === node) {
        // This is the first child
        if (orientation === 'vertical') {
            const usableWidth = Math.max(parentRect.width - gapPercentX, 0);
            return {
                x: parentRect.x,
                y: parentRect.y,
                width: usableWidth * ratio,
                height: parentRect.height
            };
        } else {
            const usableHeight = Math.max(parentRect.height - gapPercentY, 0);
            return {
                x: parentRect.x,
                y: parentRect.y,
                width: parentRect.width,
                height: usableHeight * ratio
            };
        }
    } else {
        // This is the second child
        if (orientation === 'vertical') {
            const usableWidth = Math.max(parentRect.width - gapPercentX, 0);
            const firstWidth = usableWidth * ratio;
            return {
                x: parentRect.x + firstWidth + gapPercentX,
                y: parentRect.y,
                width: usableWidth - firstWidth,
                height: parentRect.height
            };
        } else {
            const usableHeight = Math.max(parentRect.height - gapPercentY, 0);
            const firstHeight = usableHeight * ratio;
            return {
                x: parentRect.x,
                y: parentRect.y + firstHeight + gapPercentY,
                width: parentRect.width,
                height: usableHeight - firstHeight
            };
        }
    }
}

function cleanupAllResizeHandles() {
    const handles = workspace.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        if (handle.parentElement === workspace) {
            workspace.removeChild(handle);
        }
    });
}

function resetToHome() {
    // Close all windows
    const windowIds = Array.from(windowsById.keys());
    windowIds.forEach(id => {
        const leaf = windowsById.get(id);
        if (leaf && leaf.windowData.element) {
            const element = leaf.windowData.element;
            if (element.parentElement === workspace) {
                workspace.removeChild(element);
            }
        }
        windowsById.delete(id);
    });

    // Clean up all resize handles
    cleanupAllResizeHandles();

    // Reset layout
    layoutRoot = null;
    windowCounter = 0;

    // Add the first window
    addNewWindow();
}

// Initialize
calculateGapPercentages();
addNewWindow();

// Watch for workspace size changes
const resizeObserver = new ResizeObserver(() => {
    calculateGapPercentages();
    updateWindowLayout();
});
resizeObserver.observe(workspace);

