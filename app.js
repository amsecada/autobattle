document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const startGameBtn = document.getElementById('start-game');
    const settingsBtn = document.getElementById('settings');
    const playerGrid = document.getElementById('player-grid');
    const enemyGrid = document.getElementById('enemy-grid');
    const combatLog = document.getElementById('combat-log');
    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverMessage = document.getElementById('game-over-message');
    const playAgainBtn = document.getElementById('play-again-btn');
    const statCard = document.getElementById('stat-card');
    const statCardName = document.getElementById('stat-card-name');
    const statCardHp = document.getElementById('stat-card-hp');
    const statCardStrength = document.getElementById('stat-card-strength');
    const statCardDexterity = document.getElementById('stat-card-dexterity');
    const statCardStaminaGain = document.getElementById('stat-card-stamina-gain');


    // Game State
    let gameRunning = false;
    const playerCharacters = [];
    const enemyCharacters = [];
    let characterDataStore = {}; // To hold loaded JSON data
    const cellCharacterMap = new Map();

    // --- Data Loading ---
    async function loadJson(filePath) {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }
        return response.json();
    }

    async function loadAllCharacterData() {
        const heroFiles = ['squire', 'archer'];
        const enemyFiles = ['gobgob']; // Add more enemy files here later

        const heroPromises = heroFiles.map(name => loadJson(`data/heroes/${name}.json`));
        const enemyPromises = enemyFiles.map(name => loadJson(`data/enemies/${name}.json`));

        const [heroData, enemyData] = await Promise.all([
            Promise.all(heroPromises),
            Promise.all(enemyPromises)
        ]);

        const allData = {};
        heroData.forEach(h => allData[h.name] = h);
        enemyData.forEach(e => allData[e.name] = e);

        return allData;
    }


    // Character Class
    class Character {
        constructor(name, art, stats) {
            this.name = name;
            this.art = art;
            this.stats = {
                maxHp: stats.hp,
                hp: stats.hp,
                stamina: 0,
                maxStamina: 100,
                strength: stats.strength,
                dexterity: stats.dexterity,
                blockChance: stats.blockChance,
                staminaGain: (1 + (stats.dexterity / 5)) * 0.7
            };
            this.cellId = null;
            this.row = null;
            this.col = null;
        }
    }

    // --- Game Logic Functions ---

    function logMessage(message, color = '#f0f0f0') {
        const p = document.createElement('p');
        p.textContent = message;
        p.style.color = color;
        p.classList.add('combat-log-message');
        combatLog.appendChild(p);
        combatLog.scrollTop = combatLog.scrollHeight;
    }

    function createGrid(gridElement, side) {
        gridElement.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            const cellId = `${side}-cell-${i}`;
            cell.id = cellId;

            cell.addEventListener('mouseover', (event) => {
                if (cellCharacterMap.has(cellId)) {
                    const character = cellCharacterMap.get(cellId);
                    statCardName.textContent = character.name;
                    statCardHp.textContent = `HP: ${character.stats.hp} / ${character.stats.maxHp}`;
                    statCardStrength.textContent = `Strength: ${character.stats.strength}`;
                    statCardDexterity.textContent = `Dexterity: ${character.stats.dexterity}`;
                    statCardStaminaGain.textContent = `Stamina Gain: ${character.stats.staminaGain.toFixed(2)}`;

                    statCard.style.left = `${event.pageX + 15}px`;
                    statCard.style.top = `${event.pageY + 15}px`;
                    statCard.style.display = 'block';
                }
            });

            cell.addEventListener('mouseout', () => {
                statCard.style.display = 'none';
            });

            gridElement.appendChild(cell);
        }
    }

    function placeCharacter(character, side, cellIndex) {
        const cellId = `${side}-cell-${cellIndex}`;
        character.cellId = cellId;
        character.row = Math.floor(cellIndex / 5);
        character.col = cellIndex % 5;

        cellCharacterMap.set(cellId, character);

        const cell = document.getElementById(cellId);
        cell.innerHTML = `
            <div class="hp-bar-container"><div class="hp-bar" style="width: 100%;"></div></div>
            <div class="stamina-bar-container"><div class="stamina-bar" style="width: 0%;"></div></div>
            <pre class="character-art">${character.art}</pre>
            <div class="character-name">${character.name}</div>
        `;
    }

    function updateCharacterUI(character) {
        if (!character.cellId) return;
        const cell = document.getElementById(character.cellId);
        if (!cell) return;

        const hpBar = cell.querySelector('.hp-bar');
        const staminaBar = cell.querySelector('.stamina-bar');

        if (hpBar) {
            const hpPercent = (character.stats.hp / character.stats.maxHp) * 100;
            hpBar.style.width = `${hpPercent}%`;
        }

        if (staminaBar) {
            const staminaPercent = (character.stats.stamina / character.stats.maxStamina) * 100;
            staminaBar.style.width = `${staminaPercent}%`;
        }
    }

    function showFloatingText(character, text, type) {
        const cell = document.getElementById(character.cellId);
        if (!cell) return;

        const textElement = document.createElement('div');
        textElement.classList.add('floating-text', type);
        textElement.textContent = text;

        cell.appendChild(textElement);

        // Remove the element after the animation ends
        setTimeout(() => {
            textElement.remove();
        }, 1000); // Corresponds to animation duration
    }

    function showGameOverModal(message) {
        gameOverMessage.textContent = message;
        gameOverModal.style.display = 'flex';
    }

    function checkGameOver() {
        const allEnemiesDefeated = enemyCharacters.every(char => char.stats.hp <= 0);
        const allPlayersDefeated = playerCharacters.every(char => char.stats.hp <= 0);

        if (allEnemiesDefeated) {
            gameRunning = false;
            logMessage('All enemies defeated. You win!', 'gold');
            showGameOverModal('Victory!');
        } else if (allPlayersDefeated) {
            gameRunning = false;
            logMessage('All your characters have been defeated. You lose.', 'tomato');
            showGameOverModal('Defeat!');
        }
    }

    function takeTurn(character) {
        const isPlayer = playerCharacters.includes(character);
        const targetSide = isPlayer ? enemyCharacters : playerCharacters;
        const attacker = character;

        let livingTargets = targetSide.filter(t => t.stats.hp > 0);
        if (livingTargets.length === 0) return;

        let defender;

        // --- Advanced Targeting Logic ---
        if (isPlayer) {
            const enemyColumns = [...new Set(livingTargets.map(t => t.col))];
            const frontColumn = Math.min(...enemyColumns);

            if (attacker.name === 'Squire') {
                let frontLineTargets = livingTargets.filter(t => t.col === frontColumn);
                if (frontLineTargets.length > 0) {
                    // Attack the one with the lowest HP in the front line
                    defender = frontLineTargets.sort((a, b) => a.stats.hp - b.stats.hp)[0];
                }
            } else if (attacker.name === 'Archer') {
                let backLineTargets = livingTargets.filter(t => t.col !== frontColumn);
                if (backLineTargets.length > 0) {
                     // Attack the one with the lowest HP in the back line
                    defender = backLineTargets.sort((a, b) => a.stats.hp - b.stats.hp)[0];
                } else {
                    // If no back line, archer can hit the front line
                    defender = livingTargets.sort((a, b) => a.stats.hp - b.stats.hp)[0];
                }
            }
        }

        // --- Default Targeting (for enemies or if no specific target was found) ---
        if (!defender) {
            // Default: attack closest (lowest row, then lowest col)
             defender = livingTargets.sort((a, b) => {
                if (a.row !== b.row) return a.row - b.row;
                return a.col - b.col;
            })[0];
        }

        if (!defender) { // Should not happen if livingTargets > 0, but as a safeguard.
            return;
        }

        logMessage(`${attacker.name} attacks ${defender.name}!`);

        // --- Combat Resolution (same as before) ---

        // Handle Miss
        if (Math.random() < 0.10) {
            logMessage('...but it MISSED!', 'yellow');
            showFloatingText(defender, 'MISS', 'miss');
            return;
        }

        // Handle Dodge
        const dodgeChance = defender.stats.dexterity / 100;
        if (Math.random() < dodgeChance) {
            logMessage(`${defender.name} DODGED the attack!`, 'cyan');
            showFloatingText(defender, 'DODGE!', 'dodge');
            return;
        }

        // Handle Block
        if (Math.random() < defender.stats.blockChance) {
            logMessage(`${defender.name} BLOCKED the attack! No damage taken.`, 'lightblue');
            // Future: showFloatingText(defender, 'BLOCK', 'block');
            return;
        }

        // Calculate Damage
        let damage = attacker.stats.strength;
        const isCrit = Math.random() < (attacker.stats.strength / 100);
        if (isCrit) {
            damage = Math.round(damage * 1.5);
            logMessage(`A CRITICAL HIT!`, 'orange');
        }

        // Apply Damage and show floating text
        defender.stats.hp -= damage;
        logMessage(`${defender.name} takes ${damage} damage.`, 'red');
        if (isCrit) {
            showFloatingText(defender, `-${damage}!!`, 'crit');
        } else {
            showFloatingText(defender, `-${damage}`, 'damage');
        }

        if (defender.stats.hp < 0) defender.stats.hp = 0;

        // Check for defeat
        if (defender.stats.hp <= 0) {
            logMessage(`${defender.name} has been defeated!`, 'gray');
            const cell = document.getElementById(defender.cellId);
            if (cell) cell.innerHTML = ''; // Clear the cell
            cellCharacterMap.delete(defender.cellId); // Remove from map
            checkGameOver(); // Check for game over only when a character is defeated
        }
    }

    function gameLoop() {
        if (!gameRunning) return;

        const allCharacters = [...playerCharacters, ...enemyCharacters];
        allCharacters.forEach(char => {
            if (char.stats.hp > 0) {
                char.stats.stamina += char.stats.staminaGain;
                if (char.stats.stamina >= char.stats.maxStamina) {
                    char.stats.stamina = char.stats.maxStamina;
                    takeTurn(char);
                    char.stats.stamina = 0;
                }
            }
            updateCharacterUI(char);
        });

        requestAnimationFrame(gameLoop);
    }

    function setupGame() {
        combatLog.innerHTML = '';
        playerCharacters.length = 0;
        enemyCharacters.length = 0;
        cellCharacterMap.clear();

        createGrid(playerGrid, 'player');
        createGrid(enemyGrid, 'enemy');

        const heroTypes = ['Squire', 'Archer'];
        const heroPositions = [7, 12, 17]; // Middle column positions

        for (let i = 0; i < 3; i++) {
            const randomHeroType = heroTypes[Math.floor(Math.random() * heroTypes.length)];
            const heroData = characterDataStore[randomHeroType];
            if (heroData) {
                const hero = new Character(heroData.name, heroData.art, heroData.stats);
                playerCharacters.push(hero);
                placeCharacter(hero, 'player', heroPositions[i]);
                logMessage(`A ${hero.name} joins your ranks!`, "lightgreen");
            }
        }

        const gobgobData = characterDataStore['Gobgob'];
        const enemyPositions = [7, 12, 17]; // Middle column positions

        if (gobgobData) {
            for (let i = 0; i < 3; i++) {
                const gobgob = new Character(gobgobData.name, gobgobData.art, gobgobData.stats);
                enemyCharacters.push(gobgob);
                placeCharacter(gobgob, 'enemy', enemyPositions[i]);
                logMessage(`A wild ${gobgob.name} appears!`, "lightcoral");
            }
        }

        gameRunning = true;
        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---

    startGameBtn.addEventListener('click', async () => {
        mainMenu.style.display = 'none';
        gameContainer.style.display = 'block';

        try {
            characterDataStore = await loadAllCharacterData();
            setupGame();
        } catch (error) {
            console.error("Failed to load character data:", error);
            logMessage("Error: Could not load game data. Please refresh.", "red");
        }
    });

    settingsBtn.addEventListener('click', () => {
        alert('Settings clicked! This feature is not yet implemented.');
    });

    playAgainBtn.addEventListener('click', () => {
        // This also needs to be async or handle data loading appropriately
        // For now, let's just restart with the already loaded data.
        gameOverModal.style.display = 'none';
        setupGame();
    });
});
