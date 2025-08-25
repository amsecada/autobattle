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
    - `equipment/`: Contains JSON files for equippable items.
    - `abilities/`: Contains JSON files for character abilities.
    - `waves.json`: Defines the sequence of enemy encounters.
    - `Backgrounds/`: Contains .txt files with ASCII art for battle backgrounds.

## 3. Game Mechanics

### 3.1. Character Data

Character stats, names, and art are defined in JSON files located in the `data/` directory. This allows for easy modification and addition of new characters without changing the core game logic. Each character JSON file has the following structure:

```json
{
    "name": "Character Name",
    "art": "ASCII art for the character",
    "stats": {
        "hp": 100,
        "strength": 10,
        "dexterity": 5,
        "blockChance": 0.1
    }
}
```

### 3.2. Game Loop

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

## 5. New Features

### 5.1. Death Animation

A death animation has been added to the game. When a character is defeated, they will explode into their ASCII components. These components will then "evaporate" in a pixelated way.

### 5.2. Settings

A new settings modal has been added to the game. It can be accessed by clicking the "Settings" button on the main menu. The following settings are available:

-   **Blood Mode**: On/Off. Adds additional blood stylings to the death sequence.
-   **Explosion / Gore Level**: Low, Medium, High, Extreme. Determines the velocity and amount of blood during the death sequence.

### 5.3. Enhanced Targeting

The targeting system has been updated to be more user-friendly. When a player selects an ability, the game now enters a "targeting mode":

-   **Valid Targets**: Potential targets for the selected ability are highlighted with a bright glow and a slight zoom effect.
-   **Invalid Targets**: All other characters and the board itself are dimmed and desaturated, making it easy to focus on actionable targets.

### 5.4. ASCII Art Backgrounds

The game now features ASCII art backgrounds to enhance the atmosphere of the battles.

-   **Dynamic Loading**: The background is loaded from a `.txt` file specified in `app.js`.
-   **Aesthetic**: The art is styled to be subtle and not distract from the gameplay, providing an immersive, a thematic backdrop for the combat.

### 5.5. Wave and Treasure System

The game is no longer a single encounter. Players now progress through a series of waves, with each wave presenting a new set of enemies.

-   **Wave Progression**: After successfully defeating all enemies in a wave, players are presented with a choice of rewards.
-   **Treasure Selection**: A new treasure screen appears, displaying three equipment cards. Players can choose one of the three items to add to their inventory.
-   **Increasing Difficulty**: The waves are defined in `data/waves.json` and are designed to increase in difficulty, introducing stronger enemies in later waves.
-   **Gear Rarity**: Equipment now has a rarity level, indicated by a colored border on the treasure card. The rarities are: common (white), uncommon/magic (green), rare (blue), epic (purple), legendary (orange), ornate (deep red), and unique (gold).
