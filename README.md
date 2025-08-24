# Project: Turn-Based RPG Game

This document provides a technical overview of the turn-based RPG game for developers.

## 1. Overview

This project is a simple turn-based RPG game implemented in HTML, CSS, and vanilla JavaScript. The game features a player team versus an enemy team on a grid-based battlefield. The core logic is contained within `app.js`, and character data is loaded dynamically from JSON files.

## 2. File Structure

- `index.html`: The main entry point of the application. Contains the structure for the game UI.
- `style.css`: Defines the visual style for the game, including the grid, characters, and UI elements.
- `app.js`: The heart of the game. It handles all game logic, including:
    - Game state management
    - Data loading
    - Character creation and placement
    - The main game loop
    - Combat resolution
    - UI updates
- `data/`: This directory contains all the game data, separated into subdirectories.
    - `heroes/`: Contains JSON files for player-controllable characters.
    - `enemies/`: Contains JSON files for enemy characters.

## 3. Game Mechanics

### 3.1. Character Data

Character stats, names, and art are defined in JSON files located in the `data/` directory. This allows for easy modification and addition of new characters without changing the core game logic. Each character JSON file has the following structure:

```json
{
    "name": "Character Name",
    "art": "ASCII art for the character",
    "color": "css-color-name",
    "stats": {
        "hp": 100,
        "strength": 10,
        "dexterity": 5,
        "intelligence": 5,
        "blockChance": 0.1
    },
    "abilities": [
        {
            "name": "Ability Name",
            "cooldown": 5000,
            "type": "damage|heal"
        }
    ]
}
```

-   **`intelligence`**: A new stat that influences the power of magical abilities (like healing and magic attacks) and provides resistance against incoming magic damage.
-   **`abilities`**: An array of special moves a character can perform. Each ability has a name, a cooldown in milliseconds, and a type.

### 3.2. New Characters

-   **Priest (Hero)**: A supportive hero who can perform a weak melee attack or heal a friendly character with their "First Aid" ability. Their healing power is determined by their `intelligence`.
-   **Gobgob Wizard (Enemy)**: A magic-wielding enemy who can cast "Magic Missile" for significant damage or perform a weak melee attack. Their magic damage is based on their `intelligence`.

### 3.3. Game Loop & Cooldowns

The game operates on a continuous loop managed by `requestAnimationFrame(gameLoop)`. In each frame, the loop iterates through all characters on the battlefield.

- **Stamina Gain**: Each character gains a small amount of stamina. The amount is determined by their `dexterity` stat.
- **Turn-Taking**: When a character's stamina reaches its maximum value (100), they take a turn. After their action, their stamina is reset to 0.

### 3.3. Combat

- **Targeting**: The targeting logic is defined in the `takeTurn` function.
    - **Squire**: Attacks the enemy in the front-most column with the lowest HP.
    - **Archer**: Attacks the enemy in the back-most column with the lowest HP. If no back-line enemies exist, they target the front line.
    - **Enemies**: Use a default targeting system, attacking the player character that is closest to them (lowest row, then lowest column).
- **Combat Resolution**: When an attack occurs, the following checks are made in order:
    1.  **Miss Chance**: A flat 10% chance to miss.
    2.  **Dodge Chance**: Based on the defender's `dexterity`.
    3.  **Block Chance**: Based on the defender's `blockChance` stat.
    4.  **Damage Calculation**: If the attack is not avoided, damage is calculated based on the attacker's `strength`. There is a chance for a critical hit (1.5x damage), which is also based on the attacker's `strength`.

## 4. How to Modify and Extend

- **Adding a new Character**:
    1.  Create a new JSON file in the appropriate directory (`data/heroes` or `data/enemies`).
    2.  Follow the existing JSON structure for the new character.
    3.  Update the `loadAllCharacterData` function in `app.js` to include the new character's file name in the loading process.
- **Changing Game Balance**:
    - To adjust character stats, simply modify their respective JSON files.
    - To change core mechanics like stamina gain, damage formulas, or miss/dodge/block chances, edit the relevant functions in `app.js`.
- **Modifying the Grid**:
    - The grid size is hardcoded in the `createGrid` function in `app.js` (currently 25 cells, representing a 5x5 grid). To change the grid size, you would need to update this function and adjust the CSS in `style.css` accordingly.
