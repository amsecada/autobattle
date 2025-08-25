from playwright.sync_api import sync_playwright, expect

def verify_load(page):
    """
    Verifies that the main page loads correctly.
    """
    # Navigate to the game
    page.goto("http://localhost:8000")

    # Expect the main menu to be visible
    expect(page.locator("#main-menu")).to_be_visible(timeout=10000)
    expect(page.get_by_role("button", name="Start Game")).to_be_visible()

    # Take screenshot
    page.screenshot(path="jules-scratch/verification/01_main_menu.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_load(page)
            print("Verification script ran successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
