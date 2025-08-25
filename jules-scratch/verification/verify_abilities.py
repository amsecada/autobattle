import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # 1. Start the game
        await page.get_by_role("button", name="Start Game").click()
        await expect(page.locator("#player-grid .character-art")).to_have_count(3, timeout=5000)

        # --- Locate Characters ---
        # This is tricky because the characters are random. We need to find them by name.
        squire_locator = page.locator(".grid-cell:has-text('Squire')")
        archer_locator = page.locator(".grid-cell:has-text('Archer')")
        priest_locator = page.locator(".grid-cell:has-text('Priest')")
        enemy_locator = page.locator("#enemy-grid .grid-cell:has-text('Gobgob')").first

        # 2. Test Squire's "Defend" ability
        await squire_locator.click()
        await page.get_by_role("button", name="Defend").click()

        # Enter targeting mode and click the archer
        await expect(page.locator("#targeting-modal")).to_be_visible()
        await archer_locator.click()

        # Wait for the ability name to flash and disappear
        await expect(page.locator("#ability-cast-name-display")).to_be_visible()
        await expect(page.locator("#ability-cast-name-display")).to_be_hidden(timeout=2000)

        # Check for particle effects on the archer
        await expect(archer_locator.locator(".ability-particle:text('🛡')")).to_be_visible()

        # 3. Test Real-time Cooldown
        await squire_locator.click() # Re-open panel
        await expect(page.locator(".ability-button:has-text('Defend') .cooldown-text")).to_be_visible()

        # Check that the cooldown text updates to a lower number
        initial_cooldown_text = await page.locator(".ability-button:has-text('Defend') .cooldown-text").text_content()
        await asyncio.sleep(1) # wait 1 second
        updated_cooldown_text = await page.locator(".ability-button:has-text('Defend') .cooldown-text").text_content()

        print(f"Initial Cooldown: {initial_cooldown_text}, Updated Cooldown: {updated_cooldown_text}")
        assert float(updated_cooldown_text) < float(initial_cooldown_text)

        await page.locator("#ability-panel-close").click()

        # 4. Test Archer's "Snipe" ability
        await archer_locator.click()
        await page.get_by_role("button", name="Snipe").click()
        await enemy_locator.click() # Target an enemy

        # Check for the floating text indicating high damage
        await expect(enemy_locator.locator(".floating-text.damage")).to_be_visible(timeout=2000)

        # 5. Test Priest's modified "Heal" ability
        # First, let's damage the squire a bit so the heal is meaningful
        # We'll just wait for the game to play out for a few seconds
        await asyncio.sleep(3)

        await priest_locator.click()
        await page.get_by_role("button", name="Heal").click()
        await squire_locator.click() # Heal the squire

        # Check for initial heal floating text
        await expect(squire_locator.locator(".floating-text.heal:has-text('+50')")).to_be_visible()
        # Check for HoT particle effect
        await expect(squire_locator.locator(".ability-particle:text('+')")).to_be_visible(timeout=2000)

        # Take final screenshot
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
