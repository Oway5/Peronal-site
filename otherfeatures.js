// Other Features
// Theme switcher, home button, and add window button functionality

const themeSwitcher = document.getElementById('theme-switcher');
const homeButton = document.getElementById('home-button');
const addWindowButton = document.getElementById('add-window-button');

// Theme Management
const themes = ['tokyo-night', 'catppuccin', 'gruvbox', 'rose-pine'];
let currentThemeIndex = 0;

function applyTheme() {
    document.body.dataset.theme = themes[currentThemeIndex];
}

themeSwitcher.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme();
});

// Initialize theme
applyTheme();

// Home Button
homeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    resetToHome();
});

// Add Window Button
addWindowButton.addEventListener('click', (event) => {
    event.stopPropagation();
    addNewWindow();
});

