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

    // Game State
    let gameRunning = false;
    const playerCharacters = [];
    const enemyCharacters = [];

    // Character Art
    const SQUIRE_ART = `
  O
 /|\\
 / \\
`;
    const GOBGOB_ART = `
  o
 /j\\
  "
`;

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
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.id = `${side}-cell-${i}`;
            gridElement.appendChild(cell);
        }
    }

    function placeCharacter(character, side, cellIndex) {
        const cellId = `${side}-cell-${cellIndex}`;
        character.cellId = cellId;
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
        const hpPercent = (character.stats.hp / character.stats.maxHp) * 100;
        const staminaPercent = (character.stats.stamina / character.stats.maxStamina) * 100;
        hpBar.style.width = `${hpPercent}%`;
        staminaBar.style.width = `${staminaPercent}%`;
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

        const livingTargets = targetSide.filter(t => t.stats.hp > 0);
        if (livingTargets.length === 0) return;

        const defender = livingTargets[0];
        logMessage(`${attacker.name} attacks ${defender.name}!`);

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
        }

        checkGameOver();
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

        createGrid(playerGrid, 'player');
        createGrid(enemyGrid, 'enemy');

        const squire = new Character('Squire', SQUIRE_ART, { hp: 100, strength: 10, dexterity: 5, blockChance: 0.1 });
        const gobgob = new Character('Gobgob', GOBGOB_ART, { hp: 80, strength: 8, dexterity: 8, blockChance: 0.05 });
        playerCharacters.push(squire);
        enemyCharacters.push(gobgob);

        placeCharacter(squire, 'player', 4);
        placeCharacter(gobgob, 'enemy', 4);

        logMessage("A Squire appears!", "lightgreen");
        logMessage("A wild Gobgob approaches!", "lightcoral");

        gameRunning = true;
        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---

    startGameBtn.addEventListener('click', () => {
        mainMenu.style.display = 'none';
        gameContainer.style.display = 'block';
        setupGame();
    });

    settingsBtn.addEventListener('click', () => {
        alert('Settings clicked! This feature is not yet implemented.');
    });

    playAgainBtn.addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        setupGame();
    });
});
