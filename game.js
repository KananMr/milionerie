// --- STATE MANAGEMENT ---
const defaultState = {
    currentQuestion: 0,
    score: 0,
    timer: 30,
    timerPaused: false, // New state to track if timer was running
    lifelines: { fiftyFifty: true, askAudience: true, phoneFriend: true },
    selectedCategories: ['all'],
    // Questions will be pre-processed with shuffled options
    questions: [],
    gameStarted: false,
    isDarkMode: true,
};

// Use `let` so we can reassign the gameState object
let gameState = { ...defaultState };
// The interval ID is not part of the serializable state
let timerInterval = null;

/**
 * Saves the current game state to sessionStorage.
 * The timerInterval is omitted as it cannot be serialized.
 */
function saveState() {
    gameState.timerPaused = timerInterval === null; // Track if timer was running
    sessionStorage.setItem('devMillionaireState', JSON.stringify(gameState));
}

/**
 * Loads the game state from sessionStorage.
 * @returns {boolean} - True if state was loaded, false otherwise.
 */
function loadState() {
    const savedState = sessionStorage.getItem('devMillionaireState');
    if (savedState) {
        gameState = { ...defaultState, ...JSON.parse(savedState) };
        return true;
    }
    return false;
}
// --- END STATE MANAGEMENT ---


// --- CONSTANTS & ELEMENTS ---
const prizeLevels = [
    { amount: "$100", safe: false, difficulty: 1 }, { amount: "$200", safe: false, difficulty: 1 },
    { amount: "$300", safe: false, difficulty: 1 }, { amount: "$500", safe: false, difficulty: 1 },
    { amount: "$1,000", safe: true, difficulty: 1 }, { amount: "$2,000", safe: false, difficulty: 2 },
    { amount: "$4,000", safe: false, difficulty: 2 }, { amount: "$8,000", safe: false, difficulty: 2 },
    { amount: "$16,000", safe: false, difficulty: 2 }, { amount: "$32,000", safe: true, difficulty: 2 },
    { amount: "$64,000", safe: false, difficulty: 3 }, { amount: "$125,000", safe: false, difficulty: 3 },
    { amount: "$250,000", safe: false, difficulty: 3 }, { amount: "$500,000", safe: false, difficulty: 4 },
    { amount: "$1,000,000", safe: false, difficulty: 4 }
];
const timerDurations = { 1: 30, 2: 45, 3: 60, 4: 90 };
const elements = {
    gameArea: document.getElementById('game-area'),
    endScreen: document.getElementById('end-screen'),
    question: document.getElementById('question'),
    options: document.getElementById('options'),
    timerValue: document.getElementById('timer-value'),
    restartButton: document.getElementById('restart-button'),
    fiftyFifty: document.getElementById('fifty-fifty'),
    askAudience: document.getElementById('ask-audience'),
    phoneFriend: document.getElementById('phone-friend'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalDynamicArea: document.getElementById('modal-dynamic-area'),
    modalButton: document.getElementById('modal-button'),
    endTitle: document.getElementById('end-title'),
    endMessage: document.getElementById('end-message'),
    prizeWon: document.getElementById('prize-won'),
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    progressContainer: document.querySelector('.progress'),
};
// --- END CONSTANTS & ELEMENTS ---


// --- SOUND & UTILITY FUNCTIONS ---
function playSound(type) { try { const sound = document.getElementById(`sound-${type}`); if (sound) { sound.currentTime = 0; sound.play(); } } catch (e) { console.error(`Could not play sound: ${type}`, e); } }
function stopSound(type) { try { const sound = document.getElementById(`sound-${type}`); if (sound) { sound.pause(); sound.currentTime = 0; } } catch (e) { console.error(`Could not stop sound: ${type}`, e); } }
function stopAllSounds() { document.querySelectorAll('#audio-container audio').forEach(sound => { sound.pause(); sound.currentTime = 0; }); }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } return array; }
async function fetchQuestionsForCategory(category) { try { const response = await fetch(`questions/${category}.json?v=${Date.now()}`); if (!response.ok) { console.error(`Failed to load questions for ${category}`); return []; } return await response.json(); } catch (error) { console.error(`Error fetching ${category}.json:`, error); return []; } }
function organizeQuestionsByDifficulty(questions) { const organized = { 1: [], 2: [], 3: [], 4: [] }; questions.forEach(q => { if (organized[q.difficulty]) { organized[q.difficulty].push(q); }}); Object.keys(organized).forEach(d => shuffleArray(organized[d])); return organized; }
function getCurrentDifficulty() { const idx = gameState.currentQuestion; return idx < 5 ? 1 : (idx < 10 ? 2 : (idx < 13 ? 3 : 4)); }
function getDifficultyName(difficulty) { return { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Very Hard' }[difficulty] || 'Unknown'; }
/**
 * Selects questions for the game and pre-shuffles their options.
 * This ensures the option order is consistent throughout a game session.
 * @param {object} questionsByDifficulty - Questions organized by difficulty.
 * @returns {Array} - The final array of 15 question objects for the game.
 */
function selectGameQuestions(questionsByDifficulty) {
    const gameQuestions = [];
    const questionsNeeded = { 1: 5, 2: 5, 3: 3, 4: 2 };
    for (let difficulty = 1; difficulty <= 4; difficulty++) {
        const selected = (questionsByDifficulty[difficulty] || []).slice(0, questionsNeeded[difficulty]);
        // Pre-shuffle options for each selected question and store them
        selected.forEach(q => {
            const optionsWithOriginalIndex = q.options.map((text, index) => ({ text, originalIndex: index }));
            q.shuffledOptions = shuffleArray(optionsWithOriginalIndex);
        });
        gameQuestions.push(...selected);
    }
    return gameQuestions;
}
// --- END SOUND & UTILITY FUNCTIONS ---


// --- GAME FLOW & STATE ---

function initGame() {
    elements.restartButton.addEventListener('click', restartGame);
    elements.fiftyFifty.addEventListener('click', useFiftyFifty);
    elements.askAudience.addEventListener('click', useAskAudience);
    elements.phoneFriend.addEventListener('click', usePhoneFriend);
    elements.modalButton.addEventListener('click', closeModal);
    elements.darkModeToggle.addEventListener('click', () => toggleDarkMode());

    elements.progressContainer.innerHTML = prizeLevels.map((level, index) => `
        <div class="prize-level">
            <span>Q${index + 1} (${getDifficultyName(level.difficulty)})</span>
            <span class="prize-amount">${level.amount}</span>
        </div>`
    ).join('');

    if (loadState() && gameState.gameStarted) {
        resumeGame();
    } else {
        startNewGame();
    }
}

async function startNewGame() {
    gameState = { ...defaultState };

    const urlParams = new URLSearchParams(window.location.search);
    const categoriesParam = urlParams.get('categories');
    if (!categoriesParam) {
        alert("No categories selected. Returning to home.");
        window.location.href = 'index.html';
        return;
    }
    gameState.selectedCategories = categoriesParam.split(',');

    try {
        let allCategoryNames = ["algorithms", "backend", "computer-architecture", "databases", "devops", "frontend", "linux", "networking", "javascript", "php", "python", "go", "java", "csharp", "c++"];
        let categoriesToFetch = gameState.selectedCategories.includes('all') ? allCategoryNames : gameState.selectedCategories;
        
        const questionArrays = await Promise.all(categoriesToFetch.map(fetchQuestionsForCategory));
        const allQuestions = questionArrays.flat().filter(q => q && q.question);

        const questionsByDifficulty = organizeQuestionsByDifficulty(allQuestions);
        const minRequired = { 1: 5, 2: 5, 3: 3, 4: 2 };
        for (let diff = 1; diff <= 4; diff++) {
            if ((questionsByDifficulty[diff] || []).length < minRequired[diff]) {
                alert(`Not enough ${getDifficultyName(diff)} questions for the selected categories. Please go back and select more.`);
                window.location.href = 'index.html';
                return;
            }
        }
        
        gameState.questions = selectGameQuestions(questionsByDifficulty);
        if (gameState.questions.length < 15) {
             alert(`Couldn't create a full game (${gameState.questions.length}/15). Please go back and select more categories.`);
             window.location.href = 'index.html';
             return;
        }

        gameState.gameStarted = true;
        elements.gameArea.style.display = 'flex';
        elements.endScreen.style.display = 'none';
        
        updateLifelineUI();
        playSound('bgm');
        loadNextQuestion(); // Start with the first question

    } catch (error) {
        console.error("Error starting game:", error);
        alert("A critical error occurred while setting up the game. Returning to home.");
        window.location.href = 'index.html';
    }
}

function resumeGame() {
    console.log("Resuming game from saved state.");
    elements.gameArea.style.display = 'flex';
    elements.endScreen.style.display = 'none';

    toggleDarkMode(true);
    updateLifelineUI();
    playSound('bgm');

    // Display the current question with saved timer value
    displayCurrentQuestion();
    elements.timerValue.textContent = gameState.timer;
    
    // Update timer color if it's low
    if (gameState.timer <= 10) {
        elements.timerValue.style.color = '#ef4444';
        elements.timerValue.classList.add('shaking');
    }
    
    // Only start timer if it wasn't paused when saved
    if (!gameState.timerPaused) {
        startTimer();
    }
}

/**
 * Loads the next question, resetting the timer and saving state.
 */
function loadNextQuestion() {
    if (gameState.currentQuestion >= gameState.questions.length) {
        endGame(true); // Player won
        return;
    }
    const currentDifficulty = getCurrentDifficulty();
    resetTimer(currentDifficulty); // Set timer to full duration for new question
    displayCurrentQuestion();      // Render the UI
    startTimer();                  // Start the countdown
    saveState();
}
// --- END GAME FLOW & STATE ---


// --- UI & DISPLAY FUNCTIONS ---

/**
 * Renders the current question and options on the screen without affecting the timer.
 */
function displayCurrentQuestion() {
    updateProgress();
    const questionData = gameState.questions[gameState.currentQuestion];
    elements.question.textContent = questionData.question;
    elements.options.innerHTML = '';
    const optionPrefixes = ['A', 'B', 'C', 'D'];
    
    // Use the pre-shuffled options stored in the question object
    questionData.shuffledOptions.forEach(({ text, originalIndex }, displayIndex) => {
        const button = document.createElement('button');
        button.className = 'option';
        button.innerHTML = `<span class="option-prefix">${optionPrefixes[displayIndex]}</span><span>${text}</span>`;
        button.dataset.originalIndex = originalIndex; // This links back to the correct answer
        button.addEventListener('click', () => selectAnswer(button, questionData.answer));
        elements.options.appendChild(button);
    });
}

function updateProgress() {
    elements.progressContainer.querySelectorAll('.prize-level').forEach((el, index) => {
        el.classList.remove('current', 'passed');
        if (index === gameState.currentQuestion) el.classList.add('current');
        else if (index < gameState.currentQuestion) el.classList.add('passed');
    });
}

function updateLifelineUI() {
    elements.fiftyFifty.disabled = !gameState.lifelines.fiftyFifty;
    elements.askAudience.disabled = !gameState.lifelines.askAudience;
    elements.phoneFriend.disabled = !gameState.lifelines.phoneFriend;
}

/**
 * Stops the current timer interval.
 */
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    stopSound('tick');
}

/**
 * Resets the timer value to the full duration for a given difficulty.
 * @param {number} difficulty - The current question difficulty (1-4).
 */
function resetTimer(difficulty = 1) {
    stopTimer();
    gameState.timer = timerDurations[difficulty] || 30;
    elements.timerValue.textContent = gameState.timer;
    elements.timerValue.style.color = '';
    elements.timerValue.classList.remove('shaking');
    gameState.timerPaused = false;
}

/**
 * Starts the timer interval, counting down from the current gameState.timer value.
 */
function startTimer() {
    stopTimer(); // Ensure no multiple intervals are running
    if (!gameState.gameStarted) return;
    
    // Only play tick sound if timer is above 10 seconds
    if (gameState.timer > 10) {
        playSound('tick');
    }
    
    timerInterval = setInterval(() => {
        gameState.timer--;
        elements.timerValue.textContent = gameState.timer;
        
        if (gameState.timer === 10) {
            elements.timerValue.style.color = '#ef4444';
            elements.timerValue.classList.add('shaking');
            playSound('tick'); // Start playing tick sound when timer gets to 10
        }
        
        if (gameState.timer <= 0) {
            stopTimer();
            const correctButton = Array.from(elements.options.querySelectorAll('.option')).find(btn => parseInt(btn.dataset.originalIndex) === gameState.questions[gameState.currentQuestion].answer);
            if (correctButton) correctButton.classList.add('correct');
            setTimeout(() => handleWrongAnswer(true), 1500);
        }
        
        saveState(); // Save state with updated timer value
    }, 1000);
}

function toggleDarkMode(isInitial = false) {
    if (!isInitial) {
        gameState.isDarkMode = !gameState.isDarkMode;
        saveState();
    }
    document.body.classList.toggle('light-mode', !gameState.isDarkMode);
    elements.darkModeToggle.textContent = gameState.isDarkMode ? '☀️' : '🌙';
}
// --- END UI & DISPLAY FUNCTIONS ---


// --- USER ACTIONS & LIFELINES ---

function selectAnswer(selectedButton, correctOriginalIndex) {
    stopTimer();
    const optionButtons = Array.from(elements.options.querySelectorAll('.option'));
    optionButtons.forEach(button => button.disabled = true);
    const selectedOriginalIndex = parseInt(selectedButton.dataset.originalIndex);
    const correctButton = optionButtons.find(btn => parseInt(btn.dataset.originalIndex) === correctOriginalIndex);

    if (correctButton) correctButton.classList.add('correct');
    
    if (selectedOriginalIndex === correctOriginalIndex) {
        gameState.score++;
        playSound('correct');
        const qIndex = gameState.currentQuestion;
        setTimeout(() => {
            if (qIndex === 4) showTransitionModal("Impressive...", "You cleared the easy questions. Don't get cocky.");
            else if (qIndex === 9) showTransitionModal("Still Here?", "Medium questions done. The real test begins now.");
            else if (qIndex === 12) showTransitionModal("A Fluke, Surely.", "Hard questions defeated. Prepare for pain.");
            else { gameState.currentQuestion++; loadNextQuestion(); }
        }, 2000);
    } else {
        selectedButton.classList.add('wrong');
        playSound('wrong');
        setTimeout(() => handleWrongAnswer(false), 1500);
    }
}

function useFiftyFifty() {
    if (!gameState.lifelines.fiftyFifty) return;
    gameState.lifelines.fiftyFifty = false;
    updateLifelineUI();
    playSound('lifeline');

    const correctOriginalIndex = gameState.questions[gameState.currentQuestion].answer;
    const incorrectButtons = Array.from(elements.options.querySelectorAll('.option')).filter(btn => parseInt(btn.dataset.originalIndex) !== correctOriginalIndex);
    shuffleArray(incorrectButtons).slice(0, 2).forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.3';
        button.querySelector('span:last-child').innerHTML = ' ';
    });
    saveState();
}

function useAskAudience() {
    if (!gameState.lifelines.askAudience) return;
    gameState.lifelines.askAudience = false;
    updateLifelineUI();
    playSound('lifeline');

    const correctOriginalIndex = gameState.questions[gameState.currentQuestion].answer;
    const currentDifficulty = getCurrentDifficulty();
    const confidenceRanges = { 1: [60, 80], 2: [50, 65], 3: [35, 55], 4: [25, 45] };
    const activeButtons = Array.from(elements.options.querySelectorAll('.option:not(:disabled)'));
    let percentages = {}; let remaining = 100;
    const correctButton = activeButtons.find(btn => parseInt(btn.dataset.originalIndex) === correctOriginalIndex);

    if (correctButton) {
        const [min, max] = confidenceRanges[currentDifficulty];
        const correctPercent = Math.floor(Math.random() * (max - min + 1)) + min;
        percentages[correctButton.querySelector('.option-prefix').textContent] = correctPercent;
        remaining -= correctPercent;
    }
    const otherOptions = activeButtons.filter(btn => btn !== correctButton);
    shuffleArray(otherOptions).forEach((btn, i) => {
        const prefix = btn.querySelector('.option-prefix').textContent;
        if (i === otherOptions.length - 1) {
            percentages[prefix] = Math.max(0, remaining);
        } else {
            const percent = Math.floor(Math.random() * (remaining / (otherOptions.length - i) * 1.5));
            percentages[prefix] = Math.max(0, Math.min(percent, remaining));
            remaining -= percentages[prefix];
        }
    });
    showModal("Ask the Audience", "They're probably as clueless as you are.",
        `<div class="audience-chart">${Object.entries(percentages).map(([p, v]) => `<div class="audience-bar" style="height: ${v}%" title="Option ${p}: ${v}%"><span class="audience-percentage">${v}%</span><span>${p}</span></div>`).join('')}</div>`);
    saveState();
}

function usePhoneFriend() {
    if (!gameState.lifelines.phoneFriend) return;
    gameState.lifelines.phoneFriend = false;
    updateLifelineUI();
    playSound('lifeline');
    
    const correctOriginalIndex = gameState.questions[gameState.currentQuestion].answer;
    const currentDifficulty = getCurrentDifficulty();
    const accuracyRates = { 1: 0.90, 2: 0.70, 3: 0.50, 4: 0.30 };
    const activeButtons = Array.from(elements.options.querySelectorAll('.option:not(:disabled)'));
    const correctButton = activeButtons.find(btn => parseInt(btn.dataset.originalIndex) === correctOriginalIndex);

    let friendAnswerButton = (correctButton && Math.random() < accuracyRates[currentDifficulty])
        ? correctButton
        : shuffleArray(activeButtons.filter(btn => btn !== correctButton))[0] || activeButtons[0];
    
    const friendName = shuffleArray(["Sarcastic Steve", "Unhelpful Uma", "Clueless Chad", "Devilish Deb"])[0];
    const confidence = shuffleArray({
        1: ["Are you serious? It's obviously", "I can't believe you're using a lifeline for this. It's"],
        2: ["Ugh, fine. I *think* it's", "I'm busy, but I guess it's"],
        3: ["I have literally no idea. Let's say...", "You're on your own. But if I had to guess, maybe"],
        4: ["Why are you asking me?! Just pick", "I'm hanging up. Maybe try"]
    }[currentDifficulty])[0];
    
    showModal(`Calling ${friendName}...`, `"${confidence} <strong>${friendAnswerButton.querySelector('.option-prefix').textContent}</strong>. Now don't call me again."`, `<div class="phone-friend"></div>`);
    saveState();
}
// --- END USER ACTIONS & LIFELINES ---


// --- MODALS & END-GAME LOGIC ---
function handleWrongAnswer(isTimeout) {
    const taunts = isTimeout 
        ? ["Too slow!", "Time's up, genius.", "The clock beat you."]
        : ["Wrong!", "Not even close.", "Seriously?", "Ouch. That's embarrassing."];
    const message = isTimeout
        ? ["You hesitated and lost. Pathetic.", "Should've answered faster.", "The correct answer is now irrelevant."]
        : ["The correct answer was so obvious.", "Maybe try a different career path.", "My dog knew that one."];
    showModal(
        shuffleArray(taunts)[0],
        shuffleArray(message)[0]
    );
    elements.modalButton.onclick = () => {
        closeModal();
        endGame(false);
    };
}
        
function showTransitionModal(title, message) {
    showModal(title, message);
    elements.modalButton.onclick = () => {
        closeModal();
        gameState.currentQuestion++;
        loadNextQuestion();
        elements.modalButton.onclick = closeModal; // Restore default
    };
}

function showModal(title, message, dynamicContentHTML = '') {
    stopTimer();
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.modalDynamicArea.innerHTML = dynamicContentHTML;
    elements.modal.classList.add('show');
}

function closeModal() {
    elements.modal.classList.remove('show');
    // Only resume timer if the game is still active.
    if (gameState.gameStarted && elements.endScreen.style.display !== 'block') {
        startTimer();
    }
}

function endGame(isWinner) {
    stopAllSounds();
    stopTimer();
    gameState.gameStarted = false;
    let prizeMoney = "$0";

    if (isWinner && gameState.score === prizeLevels.length) {
        elements.endTitle.textContent = "IMPOSSIBLE!";
        elements.endMessage.textContent = `You actually... won? I demand a recount. You cheated.`;
        prizeMoney = prizeLevels[prizeLevels.length - 1].amount;
        playSound('win');
    } else {
        elements.endTitle.textContent = "Game Over. As Expected.";
        const reason = gameState.timer <= 0 ? 'You were too slow!' : 'That was a terrible guess.';
        elements.endMessage.textContent = `${reason} You stumbled through ${gameState.score} questions.`;
        for (let i = gameState.score - 1; i >= 0; i--) {
            if (prizeLevels[i] && prizeLevels[i].safe) {
                prizeMoney = prizeLevels[i].amount;
                break;
            }
        }
        playSound('lose');
    }
    
    elements.prizeWon.textContent = prizeMoney;
    elements.gameArea.style.display = 'none';
    elements.endScreen.style.display = 'block';

    sessionStorage.removeItem('devMillionaireState');
}

function restartGame() {
    stopAllSounds();
    sessionStorage.removeItem('devMillionaireState');
    window.location.href = 'index.html';
}
// --- END MODALS & END-GAME LOGIC ---


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', initGame);