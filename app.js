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
    const statCardEquipment = document.getElementById('stat-card-equipment');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const bloodModeSelect = document.getElementById('blood-mode');
    const goreLevelSelect = document.getElementById('gore-level');


    // Game Settings
    let bloodMode = 'on';
    let goreLevel = 'medium';


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
        const enemyFiles = ['gobgob', 'gobgob_wizard'];
        const equipmentFiles = ['rusty_longsword', 'rusty_crossbow', 'rusty_club'];

        const heroPromises = heroFiles.map(name => loadJson(`data/heroes/${name}.json`));
        const enemyPromises = enemyFiles.map(name => loadJson(`data/enemies/${name}.json`));
        const equipmentPromises = equipmentFiles.map(name => loadJson(`data/equipment/${name}.json`));


        const [heroData, enemyData, equipmentData] = await Promise.all([
            Promise.all(heroPromises),
            Promise.all(enemyPromises),
            Promise.all(equipmentPromises)
        ]);

        const allData = {
            characters: {},
            equipment: {}
        };
        heroData.forEach(h => allData.characters[h.name] = h);
        enemyData.forEach(e => allData.characters[e.name] = e);
        equipmentData.forEach(e => allData.equipment[e.name.toLowerCase().replace(/ /g, '_')] = e);

        return allData;
    }


    // Character Class
    class Character {
        constructor(name, art, stats, color = '#f0f0f0') {
            this.name = name;
            this.art = art;
            this.color = color;
            this.stats = {
                maxHp: stats.hp,
                hp: stats.hp,
                stamina: -100, // Start on cooldown
                maxStamina: 100,
                strength: stats.strength,
                dexterity: stats.dexterity,
                blockChance: stats.blockChance,
                staminaGain: (1 + (stats.dexterity / 5)) * 0.7
            };
            this.cellId = null;
            this.row = null;
            this.col = null;
            this.equipment = {
                weapon: null,
                offhand: null,
                trinket: null
            };
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

                    let equipmentText = 'Weapon: ';
                    const { weapon, offhand, trinket } = character.equipment;
                    if (weapon) {
                        equipmentText += `${weapon.name} (${weapon.stats.damage[0]}-${weapon.stats.damage[1]} dmg)`;
                    } else {
                        equipmentText += 'None';
                    }
                    statCardEquipment.textContent = equipmentText;

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
        if (!cell) return;

        // Create a container for all art elements
        const artContainer = document.createElement('div');
        artContainer.classList.add('art-container');

        // Character Art
        const charArt = document.createElement('pre');
        charArt.classList.add('character-art');
        charArt.style.color = character.color;
        charArt.textContent = character.art;
        artContainer.appendChild(charArt);

        // Equipment Art
        const { weapon, offhand, trinket } = character.equipment;
        if (weapon) {
            const weaponArt = document.createElement('pre');
            weaponArt.classList.add('equipment-art', 'weapon');
            weaponArt.style.color = weapon.color || character.color; // Fallback to character color
            weaponArt.textContent = weapon.art;
            artContainer.appendChild(weaponArt);
        }
        if (offhand) {
            const offhandArt = document.createElement('pre');
            offhandArt.classList.add('equipment-art', 'offhand');
            offhandArt.style.color = offhand.color || character.color;
            offhandArt.textContent = offhand.art;
            artContainer.appendChild(offhandArt);
        }
        if (trinket) {
            const trinketArt = document.createElement('pre');
            trinketArt.classList.add('equipment-art', 'trinket');
            trinketArt.style.color = trinket.color || character.color;
            trinketArt.textContent = trinket.art;
            artContainer.appendChild(trinketArt);
        }

        cell.innerHTML = `
            <div class="hp-bar-container"><div class="hp-bar" style="width: 100%;"></div></div>
            <div class="stamina-bar-container"><div class="stamina-bar" style="width: 0%;"></div></div>
            <div class="character-name">${character.name}</div>
        `;
        cell.appendChild(artContainer);
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
            staminaBar.style.width = `${Math.max(0, staminaPercent)}%`;
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

    function showProjectile(source, target) {
        const projectile = document.createElement('div');
        projectile.classList.add('projectile');
        document.body.appendChild(projectile);

        const sourceRect = document.getElementById(source.cellId).getBoundingClientRect();
        const targetRect = document.getElementById(target.cellId).getBoundingClientRect();

        const startX = sourceRect.left + sourceRect.width / 2;
        const startY = sourceRect.top + sourceRect.height / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;

        projectile.style.left = `${startX}px`;
        projectile.style.top = `${startY}px`;

        // Force a reflow to apply the initial position before the transition
        projectile.getBoundingClientRect();

        projectile.style.transform = `translate(${endX - startX}px, ${endY - startY}px)`;

        setTimeout(() => {
            projectile.remove();
        }, 1000); // Match the transition duration in CSS
    }

    function triggerAnimation(character, animationClass) {
        const cell = document.getElementById(character.cellId);
        if (!cell) return;
        const artContainer = cell.querySelector('.art-container');
        if (!artContainer) return;

        artContainer.classList.add(animationClass);
        setTimeout(() => {
            artContainer.classList.remove(animationClass);
        }, 500); // Duration of the animation
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
        triggerAnimation(attacker, 'attack-shake');
        setTimeout(() => showProjectile(attacker, defender), 250); // Delay projectile to sync with animation


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
        let damage;
        if (attacker.equipment.weapon && attacker.equipment.weapon.stats.damage) {
            const [min, max] = attacker.equipment.weapon.stats.damage;
            damage = Math.floor(Math.random() * (max - min + 1)) + min;
        } else {
            damage = attacker.stats.strength;
        }

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
            triggerDeathAnimation(defender);
            cellCharacterMap.delete(defender.cellId); // Remove from map
            checkGameOver(); // Check for game over only when a character is defeated
        }
    }

    function triggerDeathAnimation(character) {
        const cell = document.getElementById(character.cellId);
        if (!cell) return;

        // Clear the cell content but keep the cell itself for the animation
        cell.innerHTML = '';

        const goreSettings = {
            low: { velocity: 50, count: 5 },
            medium: { velocity: 100, count: 10 },
            high: { velocity: 150, count: 20 },
            extreme: { velocity: 250, count: 30 },
        };

        const settings = goreSettings[goreLevel];
        const art = character.art;
        const particles = art.split('').filter(char => char.trim() !== '');

        if (bloodMode === 'on') {
            for (let i = 0; i < settings.count; i++) {
                particles.push(Math.random() > 0.5 ? '*' : '.');
            }
        }

        particles.forEach(p => {
            const particle = document.createElement('div');
            particle.classList.add('death-particle');
            particle.textContent = p;
            particle.style.color = (p === '*' || p === '.') ? 'red' : character.color;

            cell.appendChild(particle);

            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * settings.velocity;
            const x = Math.cos(angle) * velocity;
            const y = Math.sin(angle) * velocity;

            particle.style.setProperty('--death-transform', `translate(${x}px, ${y}px)`);

            setTimeout(() => {
                particle.remove();
            }, 1500); // Match animation duration
        });

        // After a delay, clear the cell completely to allow for reuse
        setTimeout(() => {
            if (document.getElementById(character.cellId)) {
                 document.getElementById(character.cellId).innerHTML = '';
            }
        }, 1600);
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
            const heroData = characterDataStore.characters[randomHeroType];
            if (heroData) {
                const hero = new Character(heroData.name, heroData.art, heroData.stats, heroData.color);
                if (heroData.default_equipment) {
                    Object.keys(heroData.default_equipment).forEach(slot => {
                        const equipmentName = heroData.default_equipment[slot];
                        hero.equipment[slot] = characterDataStore.equipment[equipmentName];
                    });
                }
                playerCharacters.push(hero);
                placeCharacter(hero, 'player', heroPositions[i]);
                logMessage(`A ${hero.name} joins your ranks!`, "lightgreen");
            }
        }

        const enemyTypes = ['Gobgob', 'Gobgob Wizard'];
        const enemyPositions = [7, 12, 17]; // Middle column positions

        for (let i = 0; i < 3; i++) {
            const randomEnemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            const enemyData = characterDataStore.characters[randomEnemyType];
            if (enemyData) {
                const enemy = new Character(enemyData.name, enemyData.art, enemyData.stats, enemyData.color);
                if (enemyData.default_equipment) {
                    Object.keys(enemyData.default_equipment).forEach(slot => {
                        const equipmentName = enemyData.default_equipment[slot];
                        enemy.equipment[slot] = characterDataStore.equipment[equipmentName];
                    });
                }
                enemyCharacters.push(enemy);
                placeCharacter(enemy, 'enemy', enemyPositions[i]);
                logMessage(`A wild ${enemy.name} appears!`, "lightcoral");
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
        settingsModal.style.display = 'flex';
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    bloodModeSelect.addEventListener('change', (e) => {
        bloodMode = e.target.value;
    });

    goreLevelSelect.addEventListener('change', (e) => {
        goreLevel = e.target.value;
    });

    playAgainBtn.addEventListener('click', () => {
        // This also needs to be async or handle data loading appropriately
        // For now, let's just restart with the already loaded data.
        gameOverModal.style.display = 'none';
        setupGame();
    });
});
