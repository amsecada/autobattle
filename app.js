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
        const abilityFiles = ['heal']; // Hardcode for now

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

                const cooldown = character.cooldowns[ability.name];
                if (cooldown > 0) {
                    abilityButton.classList.add('on-cooldown');
                    const cooldownTimer = document.createElement('span');
                    cooldownTimer.classList.add('ability-cooldown-timer');
                    const secondsLeft = Math.ceil(cooldown / 60); // Assuming ~60 ticks per second
                    cooldownTimer.textContent = `On Cooldown (${secondsLeft}s)`;
                    abilityButton.appendChild(cooldownTimer);
                } else {
                    abilityButton.addEventListener('click', () => {
                        enterTargetingMode(character, ability);
                        abilityPanel.style.display = 'none'; // Close panel after selection
                    });
                }
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
        document.body.style.cursor = 'crosshair';

        const timeoutId = setTimeout(() => {
            logMessage('Time ran out. Auto-selecting target.', 'gray');
            autoTargetAbility();
        }, 3000);

        targetingState = { source, ability, timeoutId };

        targetingModal.style.display = 'flex';
        targetingModal.addEventListener('click', handleTargetSelection);
    }

    function handleTargetSelection(event) {
        if (!targetingState) return;

        // Since the modal is a full-screen overlay, we need to figure out what's underneath the click
        targetingModal.style.display = 'none'; // Temporarily hide the modal
        const clickedElement = document.elementFromPoint(event.clientX, event.clientY);
        targetingModal.style.display = 'flex'; // Show it again immediately

        const cell = clickedElement ? clickedElement.closest('.grid-cell') : null;

        if (!cell) {
             logMessage('No target selected. Cancelling.', 'gray');
             exitTargetingMode();
             return;
        }

        const target = cellCharacterMap.get(cell.id);
        if (!target) return;

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
        document.body.style.cursor = 'default';
        targetingState = null;

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
            medium: { velocity: 250, count: 30 },
            high: { velocity: 150, count: 20 },
            extreme: { velocity: 500, count: 50 }, // Absurd values
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

            let x, y;
            const velocity = Math.random() * settings.velocity;

            if (goreLevel === 'extreme') { // Absurd mode - shoot to adjacent cells
                const adjacentCoords = [
                    { r: -1, c: -1 }, { r: -1, c: 0 }, { r: -1, c: 1 },
                    { r: 0, c: -1 },                 { r: 0, c: 1 },
                    { r: 1, c: -1 }, { r: 1, c: 0 }, { r: 1, c: 1 },
                ];
                const targetCoord = adjacentCoords[Math.floor(Math.random() * adjacentCoords.length)];
                const cellWidth = 150; // As defined in CSS
                x = targetCoord.c * cellWidth + (Math.random() - 0.5) * cellWidth;
                y = targetCoord.r * cellWidth + (Math.random() - 0.5) * cellWidth;
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

        if (ability.particles) {
            addParticleEffect(target, ability.particles);
        }

        playAbilityAnimation(source, target, () => {
             // This code runs after the animation has panned to the target
            switch (ability.type) {
                case 'healing':
                    const healAmount = ability.potency;
                    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
                    logMessage(`${target.name} is healed for ${healAmount} HP.`, 'green');
                    showFloatingText(target, `+${healAmount}`, 'heal');
                    updateCharacterUI(target);
                    break;
                default:
                    logMessage(`Unknown ability type: ${ability.type}`, 'gray');
                    break;
            }
        });

        // Start cooldown immediately, don't wait for animation
        source.cooldowns[ability.name] = ability.cooldown;
    }

    function playAbilityAnimation(source, target, callback) {
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

    function gameLoop() {
        if (!gameRunning) return;

        const allCharacters = [...playerCharacters, ...enemyCharacters];
        allCharacters.forEach(char => {
            if (char.stats.hp > 0) {
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

        requestAnimationFrame(gameLoop);
    }

    function setupGame() {
        combatLog.innerHTML = '';
        playerCharacters.length = 0;
        enemyCharacters.length = 0;
        cellCharacterMap.clear();

        createGrid(playerGrid, 'player');
        createGrid(enemyGrid, 'enemy');

        const heroTypes = ['Squire', 'Archer', 'Priest'];
        const heroPositions = [7, 12, 17]; // Middle column positions

        for (let i = 0; i < 3; i++) {
            const randomHeroType = heroTypes[Math.floor(Math.random() * heroTypes.length)];
            const heroData = characterDataStore.characters[randomHeroType];
            if (heroData) {
                const abilities = (heroData.abilities || []).map(name => characterDataStore.abilities[name]);
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
});
