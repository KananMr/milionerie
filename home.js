// home.js
document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        startButton: document.getElementById('start-button'),
        categories: document.getElementById('categories'),
        darkModeToggle: document.getElementById('dark-mode-toggle'),
        tauntSubtitle: document.getElementById('taunt-subtitle'),
    };

    let selectedCategories = ['all'];
    let isDarkMode = true;
    let tauntInterval = null;

    const taunts = [
        "Think you're smart enough?",
        "I've seen compilers with more personality.",
        "Are you sure you're a developer?",
        "My toaster could answer these.",
        "Is that your final answer? Or your first guess?",
        "Don't worry, the first million is always the hardest... to lose.",
        "Error 404: Brain Not Found.",
    ];

    function cycleTaunts() {
        clearInterval(tauntInterval);
        tauntInterval = setInterval(() => {
            const currentTaunt = elements.tauntSubtitle.textContent;
            let newTaunt = currentTaunt;
            while (newTaunt === currentTaunt) {
                newTaunt = taunts[Math.floor(Math.random() * taunts.length)];
            }
            elements.tauntSubtitle.style.opacity = 0;
            setTimeout(() => {
                elements.tauntSubtitle.textContent = newTaunt;
                elements.tauntSubtitle.style.opacity = 1;
            }, 500);
        }, 5000);
    }

    function handleCategorySelection() {
        elements.categories.querySelectorAll('.category').forEach(button => {
            button.addEventListener('click', () => {
                const category = button.dataset.category;
                const allBtn = elements.categories.querySelector('[data-category="all"]');
                
                if (category === 'all') {
                    selectedCategories = ['all'];
                    elements.categories.querySelectorAll('.category').forEach(b => b.classList.remove('selected'));
                    allBtn.classList.add('selected');
                } else {
                    if (selectedCategories.includes('all')) {
                        selectedCategories = [];
                        if(allBtn) allBtn.classList.remove('selected');
                    }
                    const idx = selectedCategories.indexOf(category);
                    if (idx === -1) {
                        selectedCategories.push(category);
                        button.classList.add('selected');
                    } else {
                        selectedCategories.splice(idx, 1);
                        button.classList.remove('selected');
                    }
                    if (selectedCategories.length === 0 && allBtn) {
                        selectedCategories = ['all'];
                        allBtn.classList.add('selected');
                    }
                }
            });
        });
    }

    function handleStartGame() {
        elements.startButton.addEventListener('click', () => {
            if (selectedCategories.length === 0) {
                alert("You have to pick a category, genius.");
                return;
            }
            // Clear any previous game state before starting a new one
            sessionStorage.removeItem('devMillionaireState');

            // Redirect to the game page with categories as a URL parameter
            const categoryParams = selectedCategories.join(',');
            window.location.href = `game.html?categories=${encodeURIComponent(categoryParams)}`;
        });
    }

    function toggleDarkMode(isInitial = false) {
        if (!isInitial) isDarkMode = !isDarkMode;
        document.body.classList.toggle('light-mode', !isDarkMode);
        elements.darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    }

    // Initialize
    toggleDarkMode(true);
    handleCategorySelection();
    handleStartGame();
    cycleTaunts();
});