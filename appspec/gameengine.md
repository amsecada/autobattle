# Game Engine Core Spec

This document outlines the core mechanics and data structures of the game engine. It is intended as a technical reference for developers.

## 1. Core Combat Loop

The game is turn-based, but not in a traditional "I go, you go" sense. Turns are determined by a **Stamina** system.

- **Stamina Bar**: Every character has a stamina bar that goes from 0 to 100.
- **Stamina Gain**: On each tick of the game loop, characters gain stamina. The amount gained is calculated as: `(1 + (Dexterity / 5)) * 0.7`.
- **Action Trigger**: When a character's stamina reaches 100, they perform an action (attack) and their stamina is reset to 0.

## 2. Character Stats

Each character is defined by a set of core stats that influence their performance in combat.

- **`hp` (Health Points)**: The character's life force. If it reaches 0, the character is defeated.
- **`strength`**: The primary stat for determining attack damage. It also influences the chance of a critical hit.
    - Base Damage = `strength`
    - Critical Hit Chance = `strength / 100`
    - Critical Hit Damage = `damage * 1.5`
- **`dexterity`**: A versatile stat that influences:
    - **Stamina Gain**: Higher dexterity leads to faster turns.
    - **Dodge Chance**: `dexterity / 100`
- **`blockChance`**: A direct percentage chance to block an incoming attack, negating all damage.

## 3. Targeting AI

Characters have predefined targeting logic.

### Player Characters
- **Squire**: A frontline tank/damage dealer.
    - **Targeting**: Attacks the enemy in the closest column. If multiple enemies are in that column, it targets the one with the lowest current HP.
- **Archer**: A ranged damage dealer.
    - **Targeting**: Attacks the enemy in the furthest column. If multiple enemies are in that column, it targets the one with the lowest current HP. If there is no "back line", it will attack the front line.

### Enemy Characters
- **Gobgob**: A basic enemy unit.
    - **Targeting**: Attacks the player character physically closest to it on the grid (based on row, then column).

## 4. Combat Resolution Flow

When an attack is initiated, the engine follows these steps in order. If any step results in the attack being avoided, the subsequent steps are not processed.

1.  **Miss**: A global 10% chance for any attack to miss entirely.
2.  **Dodge**: The defender attempts to dodge based on their `dexterity`.
3.  **Block**: The defender attempts to block based on their `blockChance`.
4.  **Damage Dealt**: If the attack connects, damage is calculated based on the attacker's `strength` and applied to the defender's `hp`. Critical hits are also calculated at this stage.

## 5. Death Animation

When a character's HP reaches 0, a death animation is triggered.

-   **ASCII Explosion**: The character's art is deconstructed into its component ASCII characters.
-   **Particle System**: Each character becomes a particle that is animated to fly outwards from the character's original position.
-   **Evaporation**: The particles fade out over time to clear the game board.

## 6. Settings

The following settings are available to the player:

-   **Blood Mode**: On/Off. When on, additional blood particles (red dots and asterisks) are added to the death animation.
-   **Explosion / Gore Level**: Low, Medium, High, Extreme. This setting controls the velocity and number of particles in the death animation.

## 7. Enhanced Targeting

When a player activates an ability, the game enters a visual targeting mode.

-   **Highlighting**: All valid targets for the ability are highlighted with a bright, glowing effect to distinguish them from invalid targets.
-   **Desaturation**: All other elements on the screen, including other characters and the game grid, are desaturated and dimmed. This helps the player focus on the action of selecting a target.

## 8. ASCII Backgrounds

The game engine now supports thematic ASCII art backgrounds.

-   **File-Based**: Backgrounds are loaded from `.txt` files stored in the `/Backgrounds/` directory.
-   **Styling**: The backgrounds are rendered with a low opacity and a specific color to ensure they provide atmosphere without interfering with the readability of the game board.

## 9. Wave and Treasure System

The game flow is structured around a series of enemy waves and a treasure selection phase after each successful wave.

### 9.1. Wave Structure

-   **`waves.json`**: This file, located in the `data/` directory, defines the progression of the game. It contains an array of "wave" objects.
-   **Wave Object**: Each wave object has a `name` (e.g., "Wave 1: The Goblin Scouts") and an `enemies` array, which lists the `name` of each enemy character to be spawned for that wave.
-   **Progression**: The game advances through the `waves` array by incrementing the `currentWave` index in `app.js`.

### 9.2. Treasure Generation

-   **Trigger**: Treasure generation is triggered in `checkGameOver()` when all enemies in the current wave are defeated.
-   **Loot Table Creation**: The `generateTreasure()` function creates a dynamic loot table for each wave.
    -   **Base Loot**: The table is first populated with the `default_equipment` from all defeated enemies in the wave.
    -   **Rarity Upgrade**: There is a chance (defined by `rarityUpgradeChance`) to add a random high-rarity item to the loot table.
    -   **Padding**: If the loot table has fewer than three items, it is padded with random common or uncommon items.
-   **Selection**: Three unique items are randomly selected from the final loot table to be presented to the player.

### 9.3. Treasure Selection UI

-   **Modal**: A dedicated modal (`treasure-selection-modal`) is displayed, pausing the game.
-   **Cards**: Inside the modal, the three selected treasure items are displayed as clickable cards.
-   **Rarity Visualization**: Each card has a border color and a `box-shadow` that corresponds to the item's `rarity` property (defined in its JSON file). The CSS classes are named `rarity-common`, `rarity-rare`, etc.
-   **Player Choice**: When the player clicks a card, the corresponding item is added to the `playerInventory` array, and the game proceeds to the next wave by calling `setupGame()`.
