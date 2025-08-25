import asyncio
import os
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright, expect

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("serving at port", PORT)
        httpd.serve_forever()

async def main():
    # Start the server in a background thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    await asyncio.sleep(1) # Give the server a moment to start

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Navigate to the local server
        await page.goto(f'http://localhost:{PORT}/index.html')

        # Click the start button and wait for the game to load
        await page.click('#start-game')
        try:
            await page.wait_for_selector('#player-grid .grid-cell .character-art', timeout=10000)
            await page.wait_for_selector('#enemy-grid .grid-cell .character-art', timeout=10000)
        except Exception as e:
            print(f"Error waiting for characters to load: {e}")
            await page.screenshot(path='jules-scratch/verification/error.png')
            await browser.close()
            # We need to stop the server thread as well, but since it's a daemon it will exit with the main thread
            return

        # Take a screenshot of the initial game state
        await page.screenshot(path='jules-scratch/verification/01_initial_state.png')

        # There's a race condition where the game might not have a priest.
        # We'll just try to find one, but not fail if we can't.
        priest_cell = page.locator('.grid-cell', has_text='Priest').first
        if await priest_cell.count() > 0:
            await priest_cell.click()

            # Click the heal ability
            await page.locator('.ability-button', has_text='Heal').click()

            # Take a screenshot of the targeting modal
            await expect(page.locator('#targeting-modal')).to_be_visible()
            await page.screenshot(path='jules-scratch/verification/02_targeting_modal.png')

            # Since the targeting modal is up, we need to click on the coordinates of the cell
            box = await priest_cell.bounding_box()
            if box:
                await page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)


            # Wait for the heal animation to finish and take a screenshot
            await asyncio.sleep(1) # wait for particles
            await page.screenshot(path='jules-scratch/verification/03_heal_effect.png')
        else:
            print("No priest found, skipping heal test.")


        # Set gore level to extreme for blood effect
        await page.click('#settings')
        await page.select_option('#gore-level', 'extreme')
        await page.click('#close-settings')


        # This part is tricky as it requires the game to play out.
        # For verification, we can use JS to kill a character directly.
        # This is a hack for testing purposes.
        enemy_cell_id = await page.eval_on_selector(
            '#enemy-grid .grid-cell:has(.character-art)',
            'cell => cell.id',
            timeout=5000 # Add a timeout in case no enemies are found
        )

        if enemy_cell_id:
            # Use evaluate to interact with the game's internal state
            await page.evaluate(f"""(cellId) => {{
                const enemy = cellCharacterMap.get(cellId);
                if (enemy) {{
                    enemy.stats.hp = 0;
                    logMessage('Testing death effect via script...', 'magenta');
                    triggerDeathAnimation(enemy);
                    cellCharacterMap.delete(enemy.cellId);
                }}
            }}""", enemy_cell_id)

            await asyncio.sleep(0.5) # wait for animation to start
            await page.screenshot(path='jules-scratch/verification/04_blood_effect.png')
        else:
            print("No enemy found to kill.")


        await browser.close()
        # The script will hang here if the server is not stopped.
        # Since it's a daemon thread, it will be terminated when the main thread exits.

if __name__ == '__main__':
    # The script needs to be run from the root of the repository
    if "jules-scratch" not in os.getcwd():
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        os.chdir('../..') # Go up to the root

    asyncio.run(main())
