import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Create a new context with a larger viewport
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Navigating to landing page...")
        await page.goto("http://localhost:5173")
        await page.wait_for_timeout(2000)

        # Take screenshot of landing page
        await page.screenshot(path="verification/ui_landing.png")
        print("Landing page screenshot saved.")

        # Try to find "Get Started" or "Start for free"
        try:
            await page.click("text=Get Started")
            print("Clicked Get Started")
        except:
            await page.click("text=Start for free")
            print("Clicked Start for free")

        await page.wait_for_timeout(1000)
        await page.screenshot(path="verification/ui_auth_modal.png")
        print("Auth modal screenshot saved.")

        # Register
        email = f"user_{os.urandom(4).hex()}@example.com"
        # Ensure we are on register tab
        await page.click("button:has-text('Create Account')")
        await page.fill("input[placeholder='Your name']", "UI Tester")
        await page.fill("input[placeholder='Email address']", email)
        await page.fill("input[placeholder='Password (min 6 chars)']", "password123")

        # Click the submit button specifically
        await page.click("button[type='submit']:has-text('Create Account')")

        print("Registering...")
        # Wait for dashboard to appear (the "Board name..." input)
        await page.wait_for_selector("input[placeholder='Board name...']", timeout=10000)
        await page.screenshot(path="verification/ui_dashboard.png")
        print("Dashboard screenshot saved.")

        # Create board
        await page.fill("input[placeholder='Board name...']", "Test Board")
        # The button says "Create ->"
        await page.click("button:has-text('Create')")
        await page.wait_for_timeout(3000)
        await page.screenshot(path="verification/ui_editor.png")
        print("Editor screenshot saved.")

        # Skip onboarding / Close modal
        try:
            await page.click("button:has-text('Skip for now')")
        except:
            pass

        # Add a note
        # The note tool in RightToolPanel has label "Add Note (markdown)"
        # Or in LeftToolbar
        await page.click("button[title*='Add Note']")
        # Click on canvas to place it
        await page.mouse.click(600, 400)
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/ui_note_added.png")

        # Command Palette
        await page.keyboard.press("Control+k")
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/ui_command_palette.png")
        print("Command Palette screenshot saved.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
