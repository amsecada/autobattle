import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # Start game and wait for characters
        await page.get_by_role("button", name="Start Game").click()

        # The only thing we check is if 3 characters were created.
        await expect(page.locator("#player-grid .character-art")).to_have_count(3, timeout=10000)

        print("Verification successful: Characters were created.")

        await page.screenshot(path="jules-scratch/verification/final_verification.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
