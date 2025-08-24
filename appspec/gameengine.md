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
- **`intelligence`**: A stat for magical effects.
    - **Magic Damage**: Increases damage of magic abilities (e.g., `damage = intelligence * 2`).
    - **Healing Power**: Increases the amount healed by abilities (e.g., `heal = intelligence * 1.5`).
    - **Magic Resistance**: Reduces incoming magic damage (e.g., `finalDamage = incomingDamage * (1 - intelligence / 100)`).
- **`blockChance`**: A direct percentage chance to block an incoming attack, negating all damage.

## 3. Abilities and Cooldowns

Characters can now have special abilities defined in their data files. These abilities are governed by a cooldown system.

- **`abilities`**: An array in the character's JSON defining their special moves.
- **`cooldowns`**: A timestamp-based system. When an ability is used, the game records the time when it will be available again. A character cannot use an ability if it is on cooldown.

## 4. Targeting AI

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
