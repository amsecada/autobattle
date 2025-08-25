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
    const abilityPanel = document.getElementById('ability-panel');
    const abilityPanelCharName = document.getElementById('ability-panel-char-name');
    const abilityPanelAbilities = document.getElementById('ability-panel-abilities');
    const abilityPanelClose = document.getElementById('ability-panel-close');
    const targetingModal = document.getElementById('targeting-modal');
    const abilityCastNameDisplay = document.getElementById('ability-cast-name-display');


    // Game Settings
    let bloodMode = 'on';
    let goreLevel = 'medium';


    // Game State
    let gameRunning = false;
    const playerCharacters = [];
    const enemyCharacters = [];
    let characterDataStore = {}; // To hold loaded JSON data
    const cellCharacterMap = new Map();
    let targetingState = null; // { source, ability, timeoutId }
    const abilityQueue = [];

    // --- Data Loading ---
    async function loadText(filePath) {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }
        return response.text();
    }

    async function loadBackground(url) {
        try {
            const art = await loadText(url);
            const backgroundArtElement = document.getElementById('background-art');
            if (backgroundArtElement) {
                backgroundArtElement.textContent = art;
            }
        } catch (error) {
            console.error('Failed to load background art:', error);
        }
    }

    async function loadJson(filePath) {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }
        return response.json();
    }

    async function loadAllCharacterData() {
        const heroFiles = ['squire', 'archer', 'priest'];
        const enemyFiles = ['gobgob', 'gobgob_wizard'];
        const equipmentFiles = ['rusty_longsword', 'rusty_crossbow', 'rusty_club'];
        const abilityFiles = ['heal', 'defend', 'snipe'];

        const heroPromises = heroFiles.map(name => loadJson(`data/heroes/${name}.json`));
        const enemyPromises = enemyFiles.map(name => loadJson(`data/enemies/${name}.json`));
        const equipmentPromises = equipmentFiles.map(name => loadJson(`data/equipment/${name}.json`));
        const abilityPromises = abilityFiles.map(name => loadJson(`data/abilities/${name}.json`));


        const [heroData, enemyData, equipmentData, abilityData] = await Promise.all([
            Promise.all(heroPromises),
            Promise.all(enemyPromises),
            Promise.all(equipmentPromises),
            Promise.all(abilityPromises)
        ]);

        const allData = {
            characters: {},
            equipment: {},
            abilities: {}
        };
        heroData.forEach(h => allData.characters[h.name] = h);
        enemyData.forEach(e => allData.characters[e.name] = e);
        equipmentData.forEach(e => allData.equipment[e.name.toLowerCase().replace(/ /g, '_')] = e);
        abilityData.forEach(a => allData.abilities[a.name.toLowerCase()] = a);

        return allData;
    }


    // Character Class
    class Character {
        constructor(name, art, stats, color = '#f0f0f0', abilities = []) {
            console.log(`Constructor called for: ${name}`, { art, stats, color, abilities });
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
            this.abilities = abilities;
            this.cooldowns = {};
            this.abilities.forEach(ability => {
                this.cooldowns[ability.name] = 0;
            });
            this.effects = [];
            this.gameTick = 0;
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

            cell.addEventListener('click', () => {
                if (cellCharacterMap.has(cellId)) {
                    const character = cellCharacterMap.get(cellId);
                    // Only open for player characters
                    if (playerCharacters.includes(character)) {
                        openAbilityPanel(character);
                    }
                }
            });

            gridElement.appendChild(cell);
        }
    }

    function openAbilityPanel(character) {
        abilityPanelCharName.textContent = `${character.name}'s Abilities`;
        abilityPanelAbilities.innerHTML = ''; // Clear previous abilities

        if (character.abilities.length === 0) {
            abilityPanelAbilities.innerHTML = '<p>No abilities.</p>';
        } else {
            character.abilities.forEach(ability => {
                const abilityButton = document.createElement('div');
                abilityButton.classList.add('ability-button');

                const abilityName = document.createElement('h5');
                abilityName.textContent = ability.name;

                const abilityDesc = document.createElement('p');
                abilityDesc.textContent = ability.description;

                abilityButton.appendChild(abilityName);
                abilityButton.appendChild(abilityDesc);

                const cooldownWrapper = document.createElement('div');
                cooldownWrapper.classList.add('cooldown-wrapper');

                const cooldownOverlay = document.createElement('div');
                cooldownOverlay.classList.add('cooldown-overlay');
                cooldownWrapper.appendChild(cooldownOverlay);

                const cooldownText = document.createElement('span');
                cooldownText.classList.add('cooldown-text');
                cooldownWrapper.appendChild(cooldownText);

                abilityButton.appendChild(cooldownWrapper);
                abilityButton.dataset.abilityName = ability.name; // Link button to ability

                // Event listener will be handled by a single delegated listener
                // on the parent container to improve performance and simplify logic.
                abilityPanelAbilities.appendChild(abilityButton);
            });
        }

        abilityPanel.style.display = 'block';
    }

    abilityPanelClose.addEventListener('click', () => {
        abilityPanel.style.display = 'none';
    });

    function enterTargetingMode(source, ability) {
        if (targetingState) {
            exitTargetingMode(); // Clear any previous targeting state
        }

        logMessage(`Select a target for ${source.name}'s ${ability.name}.`, 'yellow');
        document.body.classList.add('targeting-active');

        // Highlight valid targets
        const potentialTargets = (ability.target === 'ally' || ability.target === 'self') ? playerCharacters : enemyCharacters;
        potentialTargets.forEach(char => {
            if (char.stats.hp > 0) {
                const cell = document.getElementById(char.cellId);
                if (cell) {
                    cell.classList.add('valid-target');
                }
            }
        });
        if (ability.target === 'self') {
            const selfCell = document.getElementById(source.cellId);
            if(selfCell) selfCell.classList.add('valid-target');
        }


        const timeoutId = setTimeout(() => {
            logMessage('Time ran out. Auto-selecting target.', 'gray');
            autoTargetAbility();
        }, 3000);

        targetingState = { source, ability, timeoutId };

        targetingModal.style.display = 'flex';
        targetingModal.addEventListener('click', handleTargetSelection);
    }

    function handleTargetSelection(event) {
        // Stop the click from propagating to elements underneath the modal
        event.preventDefault();
        event.stopPropagation();

        if (!targetingState) return;

        let clickedCell = null;
        // Get all cells and check if the click was inside one of them
        const cells = document.querySelectorAll('.grid-cell');
        for (const cell of cells) {
            const rect = cell.getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom) {
                clickedCell = cell;
                break;
            }
        }

        if (!clickedCell) {
             logMessage('No target selected. Cancelling.', 'gray');
             exitTargetingMode();
             return;
        }

        const target = cellCharacterMap.get(clickedCell.id);
        if (!target) return; // Clicked on an empty cell

        const { source, ability } = targetingState;
        const isPlayerTarget = playerCharacters.includes(target);

        // Validate target
        let isValidTarget = false;
        if (ability.target === 'ally' && isPlayerTarget) {
            isValidTarget = true;
        } else if (ability.target === 'enemy' && !isPlayerTarget) {
            isValidTarget = true;
        } else if (ability.target === 'self' && target === source) {
            isValidTarget = true;
        }
        // Add more conditions for 'any', etc. if needed

        if (isValidTarget) {
            logMessage(`${source.name} will use ${ability.name} on ${target.name}.`, 'lightblue');
            queueAbility(source, target, ability);
            exitTargetingMode();
        } else {
            logMessage('Invalid target selected.', 'tomato');
        }
    }

    function exitTargetingMode() {
        if (!targetingState) return;

        clearTimeout(targetingState.timeoutId);
        document.body.classList.remove('targeting-active');
        targetingState = null;

        // Remove highlighting from all cells
        document.querySelectorAll('.grid-cell.valid-target').forEach(cell => {
            cell.classList.remove('valid-target');
        });

        targetingModal.style.display = 'none';
        targetingModal.removeEventListener('click', handleTargetSelection);
    }

    function autoTargetAbility() {
        if (!targetingState) return;
        const { source, ability } = targetingState;
        let target;

        if (ability.target === 'ally' || ability.target === 'self') {
            // Heal the most damaged ally (lowest HP percentage)
            target = [...playerCharacters]
                .filter(p => p.stats.hp > 0)
                .sort((a, b) => (a.stats.hp / a.stats.maxHp) - (b.stats.hp / b.stats.maxHp))[0];
        } else { // 'enemy'
             // Default to the standard enemy targeting logic for now
            const livingEnemies = enemyCharacters.filter(e => e.stats.hp > 0);
            if (livingEnemies.length > 0) {
                 target = livingEnemies.sort((a, b) => {
                    if (a.row !== b.row) return a.row - b.row;
                    return a.col - b.col;
                })[0];
            }
        }

        if (target) {
            logMessage(`${source.name} will use ${ability.name} on ${target.name}.`, 'lightblue');
            queueAbility(source, target, ability);
        } else {
            logMessage(`No valid targets for ${ability.name}.`, 'gray');
        }

        exitTargetingMode();
    }

    function queueAbility(source, target, ability) {
        // This is a placeholder for now. The logic will be built out in the next step.
        abilityQueue.push({ source, target, ability });
        console.log('Ability Queued:', { source, target, ability });
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

        // --- Damage Application with Effects ---
        const defendedEffect = defender.effects.find(e => e.name === 'Defended');
        if (defendedEffect) {
            const damageReduction = defendedEffect.potency;
            const absorbedDamage = Math.round(damage * damageReduction);
            const remainingDamage = damage - absorbedDamage;

            // Apply remaining damage to original target
            defender.stats.hp -= remainingDamage;
            logMessage(`${defender.name} is defended and takes only ${remainingDamage} damage.`, 'red');
            showFloatingText(defender, `-${remainingDamage}`, 'damage');

            // Apply absorbed damage to the effect source (the Squire)
            const guard = defendedEffect.source;
            if (guard && guard.stats.hp > 0) {
                guard.stats.hp -= absorbedDamage;
                logMessage(`${guard.name} absorbs ${absorbedDamage} damage for ${defender.name}!`, 'darkred');
                showFloatingText(guard, `-${absorbedDamage}`, 'damage');
                if (guard.stats.hp <= 0) {
                    guard.stats.hp = 0;
                    logMessage(`${guard.name} has been defeated protecting an ally!`, 'gray');
                    triggerDeathAnimation(guard);
                    cellCharacterMap.delete(guard.cellId);
                }
                 updateCharacterUI(guard);
            }

        } else {
            // Apply standard damage
            defender.stats.hp -= damage;
            logMessage(`${defender.name} takes ${damage} damage.`, 'red');
            if (isCrit) {
                showFloatingText(defender, `-${damage}!!`, 'crit');
            } else {
                showFloatingText(defender, `-${damage}`, 'damage');
            }
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
            medium: { velocity: 500, count: 50 },
            high: { velocity: 150, count: 20 },
            extreme: { velocity: 1000, count: 100 },
        };

        const settings = goreSettings[goreLevel];
        const art = character.art;
        const particles = art.split('').filter(char => char.trim() !== '');

        if (bloodMode === 'on') {
            for (let i = 0; i < settings.count; i++) {
                particles.push(Math.random() > 0.5 ? '*' : '.');
            }
        }

        const originRect = cell.getBoundingClientRect();

        particles.forEach(p => {
            const particle = document.createElement('div');
            particle.classList.add('death-particle');
            particle.textContent = p;
            particle.style.color = (p === '*' || p === '.') ? 'red' : character.color;

            cell.appendChild(particle);

            let x, y;
            const velocity = Math.random() * settings.velocity;

            if (goreLevel === 'medium' || goreLevel === 'extreme') {
                const cellWidth = 150; // As defined in CSS

                if (goreLevel === 'extreme') { // Absurd mode - shoot to ANY other living character's cell
                    const livingCharacters = Array.from(cellCharacterMap.values()).filter(c => c.stats.hp > 0);
                    if (livingCharacters.length > 0) {
                        const targetCharacter = livingCharacters[Math.floor(Math.random() * livingCharacters.length)];
                        const targetCell = document.getElementById(targetCharacter.cellId);
                        const targetRect = targetCell.getBoundingClientRect();

                        const deltaX = (targetRect.left + targetRect.width / 2) - (originRect.left + originRect.width / 2);
                        const deltaY = (targetRect.top + targetRect.height / 2) - (originRect.top + originRect.height / 2);

                        x = deltaX + (Math.random() - 0.5) * cellWidth;
                        y = deltaY + (Math.random() - 0.5) * cellWidth;
                    } else { // Fallback if no other living characters
                         const angle = Math.random() * Math.PI * 2;
                         x = Math.cos(angle) * velocity;
                         y = Math.sin(angle) * velocity;
                    }
                } else { // Medium mode - shoot to adjacent cells
                    const adjacentCoords = [
                        { r: -1, c: -1 }, { r: -1, c: 0 }, { r: -1, c: 1 },
                        { r: 0, c: -1 },                 { r: 0, c: 1 },
                        { r: 1, c: -1 }, { r: 1, c: 0 }, { r: 1, c: 1 },
                    ];
                    const targetCoord = adjacentCoords[Math.floor(Math.random() * adjacentCoords.length)];
                    x = targetCoord.c * cellWidth + (Math.random() - 0.5) * cellWidth;
                    y = targetCoord.r * cellWidth + (Math.random() - 0.5) * cellWidth;
                }
            } else {
                const angle = Math.random() * Math.PI * 2;
                x = Math.cos(angle) * velocity;
                y = Math.sin(angle) * velocity;
            }


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

    function applyEffect(source, target, effectData) {
        // Add source and a unique ID to the effect instance
        const effect = {
            ...effectData,
            source: source,
            id: Date.now() + Math.random(),
            remaining: effectData.duration,
            lastTick: 0
        };

        // Check if an effect with the same name from the same source already exists
        const existingEffectIndex = target.effects.findIndex(e => e.name === effect.name && e.source === source);
        if (existingEffectIndex !== -1) {
            // Refresh duration of existing effect
            target.effects[existingEffectIndex].remaining = effect.duration;
            logMessage(`${target.name}'s ${effect.name} duration was refreshed.`, 'yellow');
        } else {
            target.effects.push(effect);
            logMessage(`${target.name} is now affected by ${effect.name}.`, 'lightblue');
        }
    }

    function addParticleEffect(target, particleData) {
        const cell = document.getElementById(target.cellId);
        if (!cell) return;

        for (let i = 0; i < particleData.count; i++) {
            const style = particleData.styles[Math.floor(Math.random() * particleData.styles.length)];
            const particle = document.createElement('div');
            particle.classList.add('ability-particle');
            particle.textContent = style.char;
            particle.style.color = style.color;

            cell.appendChild(particle);

            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * particleData.velocity;
            const x = Math.cos(angle) * velocity;
            const y = Math.sin(angle) * velocity;

            particle.style.setProperty('--ability-tx', `${x}px`);
            particle.style.setProperty('--ability-ty', `${y}px`);

            setTimeout(() => {
                particle.remove();
            }, 1000); // Match animation duration in CSS
        }
    }

    function useAbility(source, target, ability) {
        logMessage(`${source.name} uses ${ability.name} on ${target.name}!`, 'lightgreen');

        playAbilityAnimation(source, target, ability, () => {
             // This code runs after the animation has panned to the target

            // Trigger particles at the same time as the healing effect
            if (ability.particles) {
                addParticleEffect(target, ability.particles);
            }

            switch (ability.type) {
                case 'healing':
                    const healAmount = ability.potency;
                    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
                    logMessage(`${target.name} is healed for ${healAmount} HP.`, 'green');
                    showFloatingText(target, `+${healAmount}`, 'heal');
                    updateCharacterUI(target);
                    break;
                case 'defensive':
                    // No direct effect, just applying buffs/debuffs
                    logMessage(`${target.name} is being defended by ${source.name}!`);
                    break;
                case 'damage':
                    // Calculate base damage (similar to takeTurn)
                    let baseDamage;
                    if (source.equipment.weapon && source.equipment.weapon.stats.damage) {
                        const [min, max] = source.equipment.weapon.stats.damage;
                        baseDamage = Math.floor(Math.random() * (max - min + 1)) + min;
                    } else {
                        baseDamage = source.stats.strength;
                    }

                    // Apply ability potency
                    let finalDamage = baseDamage * ability.potency;

                    // Snipe can also crit
                    const isCrit = Math.random() < (source.stats.strength / 100);
                    if (isCrit) {
                        finalDamage = Math.round(finalDamage * 1.5);
                        logMessage(`A CRITICAL HIT!`, 'orange');
                    }

                    finalDamage = Math.round(finalDamage);

                    // Apply damage directly to target
                    target.stats.hp -= finalDamage;
                    logMessage(`${target.name} is hit by ${ability.name} for ${finalDamage} damage!`, 'red');
                     if (isCrit) {
                        showFloatingText(target, `-${finalDamage}!!`, 'crit');
                    } else {
                        showFloatingText(target, `-${finalDamage}`, 'damage');
                    }

                    if (target.stats.hp < 0) target.stats.hp = 0;
                    updateCharacterUI(target);

                    // Check for defeat
                    if (target.stats.hp <= 0) {
                        logMessage(`${target.name} has been defeated!`, 'gray');
                        triggerDeathAnimation(target);
                        cellCharacterMap.delete(target.cellId);
                        checkGameOver();
                    }
                    break;
                default:
                    logMessage(`Unknown ability type: ${ability.type}`, 'gray');
                    break;
            }

            // Apply any associated effects
            if (ability.effects) {
                ability.effects.forEach(effectData => {
                    let effectTarget;
                    if (effectData.applyTo === 'source') {
                        effectTarget = source;
                    } else { // 'target' is the default
                        effectTarget = target;
                    }
                    applyEffect(source, effectTarget, effectData);
                });
            }
        });

        // Start cooldown immediately, don't wait for animation
        source.cooldowns[ability.name] = ability.cooldown;
    }

    function playAbilityAnimation(source, target, ability, callback) {
        // --- Flash Ability Name ---
        abilityCastNameDisplay.textContent = ability.name;
        abilityCastNameDisplay.style.display = 'block';
        // Reset animation by removing and re-adding the class
        abilityCastNameDisplay.style.animation = 'none';
        abilityCastNameDisplay.offsetHeight; /* trigger reflow */
        abilityCastNameDisplay.style.animation = null;
        setTimeout(() => {
            abilityCastNameDisplay.style.display = 'none';
        }, 1500); // Must match animation duration in CSS

        const sourceCell = document.getElementById(source.cellId);
        const targetCell = document.getElementById(target.cellId);
        const container = document.getElementById('game-container');

        if (!sourceCell || !targetCell) {
            if (callback) callback();
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const sourceRect = sourceCell.getBoundingClientRect();
        const targetRect = targetCell.getBoundingClientRect();

        const sourceX = sourceRect.left - containerRect.left + sourceRect.width / 2;
        const sourceY = sourceRect.top - containerRect.top + sourceRect.height / 2;
        const targetX = targetRect.left - containerRect.left + targetRect.width / 2;
        const targetY = targetRect.top - containerRect.top + targetRect.height / 2;

        // --- Animation Sequence ---
        const originalGameRunning = gameRunning;
        gameRunning = false; // Pause the game loop during animation

        // 1. Zoom on Source
        container.classList.add('ability-zoom-container');
        container.style.transformOrigin = `${sourceX}px ${sourceY}px`;
        container.style.transform = 'scale(1.8)';

        // 2. Magic Effect
        setTimeout(() => {
            const magicEffect = document.createElement('div');
            magicEffect.classList.add('magic-effect');
            magicEffect.style.left = `${sourceRect.left + sourceRect.width / 2 - 25}px`;
            magicEffect.style.top = `${sourceRect.top + sourceRect.height / 2 - 25}px`;
            document.body.appendChild(magicEffect);
            setTimeout(() => magicEffect.remove(), 500);
        }, 200);


        // 3. Pan to Target and apply effect
        setTimeout(() => {
            container.style.transformOrigin = `${targetX}px ${targetY}px`;
            if (callback) callback();
        }, 600);


        // 4. Zoom Out
        setTimeout(() => {
            container.style.transform = 'scale(1)';
        }, 1100);

        // 5. Cleanup and Resume
        setTimeout(() => {
            container.classList.remove('ability-zoom-container');
            container.style.transformOrigin = '';
            container.style.transform = '';
            if (originalGameRunning) {
                gameRunning = true;
                requestAnimationFrame(gameLoop);
            }
        }, 1500);
    }

    function addEffectParticles(character, effect) {
        // Only add a particle on certain ticks to avoid overwhelming the screen
        if (character.gameTick % 15 !== 0) return;

        const cell = document.getElementById(character.cellId);
        if (!cell) return;

        let style;
        if (effect.name === 'HealOverTime') {
            style = { char: '+', color: 'lightgreen' };
        } else if (effect.name === 'Defended') {
            style = { char: '🛡', color: 'lightblue' };
        } else {
            return; // No particles for this effect
        }

        const particle = document.createElement('div');
        particle.classList.add('ability-particle'); // Can reuse this class
        particle.textContent = style.char;
        particle.style.color = style.color;
        // Make effect particles smaller and less intrusive
        particle.style.fontSize = '1rem';
        particle.style.zIndex = '50';


        cell.appendChild(particle);

        // Animate it rising up and fading out
        const x = (Math.random() - 0.5) * 40; // Less horizontal spread
        const y = -60 - (Math.random() * 20);   // Move upwards
        particle.style.setProperty('--ability-tx', `${x}px`);
        particle.style.setProperty('--ability-ty', `${y}px`);

        setTimeout(() => {
            particle.remove();
        }, 1000); // Match animation duration in CSS
    }

    function updateAbilityPanelTimers() {
        if (abilityPanel.style.display !== 'block') return;

        const charName = abilityPanelCharName.textContent.replace("'s Abilities", "");
        const character = playerCharacters.find(p => p.name === charName);
        if (!character) return;

        const buttons = abilityPanelAbilities.querySelectorAll('.ability-button');
        buttons.forEach(button => {
            const abilityName = button.dataset.abilityName;
            const ability = character.abilities.find(a => a.name === abilityName);
            if (!ability) return;

            const overlay = button.querySelector('.cooldown-overlay');
            const text = button.querySelector('.cooldown-text');
            const currentCD = character.cooldowns[abilityName];
            const totalCD = ability.cooldown;

            if (currentCD > 0) {
                button.classList.add('on-cooldown');
                const percentage = currentCD / totalCD;
                overlay.style.transform = `scaleY(${percentage})`;
                text.style.display = 'block';
                text.textContent = (currentCD / 60).toFixed(1);
            } else {
                button.classList.remove('on-cooldown');
                overlay.style.transform = 'scaleY(0)';
                text.style.display = 'none';
            }
        });
    }

    function gameLoop() {
        if (!gameRunning) return;

        const allCharacters = [...playerCharacters, ...enemyCharacters];
        allCharacters.forEach(char => {
            if (char.stats.hp > 0) {
                char.gameTick++;

                // Process effects
                char.effects = char.effects.filter(effect => {
                    effect.remaining--;
                    if (effect.remaining <= 0) {
                        logMessage(`${char.name} is no longer affected by ${effect.name}.`, 'gray');
                        return false; // Remove effect
                    }

                    // Handle tick-rate effects (e.g., HoT, DoT)
                    if (effect.tickRate && (char.gameTick - effect.lastTick >= effect.tickRate)) {
                        effect.lastTick = char.gameTick;
                        switch (effect.name) {
                            case 'HealOverTime':
                                char.stats.hp = Math.min(char.stats.maxHp, char.stats.hp + effect.potency);
                                showFloatingText(char, `+${effect.potency}`, 'heal');
                                break;
                        }
                    }

                    // Handle continuous particle effects
                    if (effect.name === 'HealOverTime' || effect.name === 'Defended') {
                        addEffectParticles(char, effect);
                    }

                    return true; // Keep effect
                });


                // Decrement cooldowns
                for (const abilityName in char.cooldowns) {
                    if (char.cooldowns[abilityName] > 0) {
                        char.cooldowns[abilityName]--;
                        // Add visual flash when cooldown finishes
                        if (char.cooldowns[abilityName] === 0) {
                            triggerAnimation(char, 'ability-ready-flash');
                        }
                    }
                }

                // Gain stamina
                char.stats.stamina += char.stats.staminaGain;
                if (char.stats.stamina >= char.stats.maxStamina) {
                    char.stats.stamina = char.stats.maxStamina;

                    // Check for a queued ability for this character
                    const queuedAbilityIndex = abilityQueue.findIndex(item => item.source === char);
                    if (queuedAbilityIndex !== -1) {
                        const { source, target, ability } = abilityQueue.splice(queuedAbilityIndex, 1)[0];

                        // Ensure target is still valid
                        if (target.stats.hp > 0) {
                            useAbility(source, target, ability);
                        } else {
                            logMessage(`${ability.name} could not be used because the target was defeated.`, 'gray');
                        }
                    } else {
                        takeTurn(char);
                    }
                    char.stats.stamina = 0;
                }
            }
            updateCharacterUI(char);
        });

        updateAbilityPanelTimers();
        requestAnimationFrame(gameLoop);
    }

    function setupGame() {
        console.log("--- Starting Game Setup ---");
        loadBackground('Backgrounds/heavy_forest.txt');
        combatLog.innerHTML = '';
        playerCharacters.length = 0;
        enemyCharacters.length = 0;
        cellCharacterMap.clear();

        createGrid(playerGrid, 'player');
        createGrid(enemyGrid, 'enemy');

        console.log("Character Data Store:", characterDataStore);

        const heroTypes = ['Squire', 'Archer', 'Priest'];
        const heroPositions = [7, 12, 17]; // Middle column positions

        for (let i = 0; i < 3; i++) {
            const randomHeroType = heroTypes[Math.floor(Math.random() * heroTypes.length)];
            console.log(`Creating hero of type: ${randomHeroType}`);
            const heroData = characterDataStore.characters[randomHeroType];
            if (heroData) {
                console.log("Hero data found:", heroData);
                const abilities = (heroData.abilities || [])
                    .map(name => characterDataStore.abilities[name.toLowerCase()])
                    .filter(Boolean); // Filter out any undefined abilities
                console.log("Mapped abilities:", abilities);
                const hero = new Character(heroData.name, heroData.art, heroData.stats, heroData.color, abilities);
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

    abilityPanelAbilities.addEventListener('click', (event) => {
        const button = event.target.closest('.ability-button');
        if (!button || button.classList.contains('on-cooldown')) {
            return; // Clicked on gap or a button on cooldown
        }

        const charName = abilityPanelCharName.textContent.replace("'s Abilities", "");
        const character = playerCharacters.find(p => p.name === charName);
        if (!character) return;

        const abilityName = button.dataset.abilityName;
        const ability = character.abilities.find(a => a.name === abilityName);
        if (!ability) return;

        enterTargetingMode(character, ability);
        abilityPanel.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        // Close ability panel if click is outside of it
        if (abilityPanel.style.display === 'block' && !abilityPanel.contains(event.target)) {
            // Check that the click was not on a character, which opens the panel
            const clickedCell = event.target.closest('.grid-cell');
            if (clickedCell && cellCharacterMap.has(clickedCell.id)) {
                // If we clicked a character, let the character click handler manage the panel
                return;
            }
            abilityPanel.style.display = 'none';
        }

        // Close settings modal if click is outside of it
        if (settingsModal.style.display === 'flex' && !settingsModal.querySelector('.modal-content').contains(event.target)) {
            settingsModal.style.display = 'none';
        }
    });
});
