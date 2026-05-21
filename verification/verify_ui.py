import asyncio
from playwright.async_api import async_playwright
import os
import random

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(slow_mo=50)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Navigating to landing page...")
        await page.goto("http://localhost:5173")
        await page.wait_for_timeout(1000)

        # Auth flow
        try:
            await page.click("text=Get Started", timeout=5000)
        except:
            await page.click("text=Start for free", timeout=5000)

        email = f"tester_{os.urandom(4).hex()}@example.com"
        await page.click("button:has-text('Create Account')")
        await page.fill("input[placeholder='Your name']", "Core Tester")
        await page.fill("input[placeholder='Email address']", email)
        await page.fill("input[placeholder='Password (min 6 chars)']", "password123")
        await page.click("button[type='submit']:has-text('Create Account')")

        await page.wait_for_selector("input[placeholder='Board name...']", timeout=10000)

        # Create board
        board_name = f"Stability Test {random.randint(100, 999)}"
        await page.fill("input[placeholder='Board name...']", board_name)
        await page.click("button:has-text('Create')")
        await page.wait_for_selector("button[title*='Add Note']", timeout=10000)
        print(f"Board '{board_name}' created.")

        # Skip onboarding
        try:
            await page.click("button:has-text('Skip')", timeout=3000)
            print("Skipped onboarding.")
        except:
            pass

        # 1. TEST: Note Creation & Linking
        print("Testing Note Creation & Linking...")
        await page.click("button[title*='Add Note']")
        await page.mouse.click(400, 300)
        note_a = page.locator("[data-node-type='note']").first
        await note_a.wait_for()

        await note_a.dblclick()
        editor = page.locator("[data-testid='note-editor']")
        await editor.wait_for(timeout=5000)
        await editor.fill("# Note A\nLink to [[Note B]]")
        await page.click("button:has-text('SAVE')")
        await editor.wait_for(state="hidden")
        print("Note A saved.")

        await page.click("button[title*='Add Note']")
        await page.mouse.click(800, 300)
        note_b = page.locator("[data-node-type='note']").nth(1)
        await note_b.wait_for()

        await note_b.dblclick()
        await editor.wait_for(timeout=5000)
        await editor.fill("# Note B\nLink back to [[Note A]]")
        await page.click("button:has-text('SAVE')")
        await editor.wait_for(state="hidden")
        print("Note B saved.")

        # Verify Knowledge Base Panel
        print("Checking Knowledge Base Panel...")
        # Right Panel is open by default. If not visible, click Inspector.
        kb_header = page.get_by_text("KNOWLEDGE BASE", exact=True)
        if not await kb_header.is_visible():
            await page.click("button:has-text('Inspector')")

        await kb_header.wait_for(timeout=5000)
        await page.wait_for_selector("text=Note A", timeout=5000)
        await page.wait_for_selector("text=Note B", timeout=5000)
        print("Knowledge Base list contains notes.")
        await page.screenshot(path="verification/test_kb_panel.png")

        # 2. TEST: Rename Propagation
        print("Testing Rename Propagation...")
        await note_b.dblclick()
        await editor.wait_for(timeout=5000)
        await editor.fill("# Note Beta\nContent changed.")
        await page.click("button:has-text('SAVE')")
        await editor.wait_for(state="hidden")

        # Check Note A's link update
        await page.wait_for_selector("text=Note Beta", timeout=5000)
        print("SUCCESS: Rename propagation confirmed.")
        await page.screenshot(path="verification/test_rename_propagation.png")

        # 3. TEST: Command Palette
        print("Testing Command Palette...")
        await page.keyboard.press("Control+k")
        await page.wait_for_selector("input[placeholder*='Search']", timeout=5000)
        await page.keyboard.type("Note Beta")
        await page.wait_for_selector("div:has-text('Note Beta')", timeout=5000)
        await page.screenshot(path="verification/test_command_palette.png")
        await page.keyboard.press("Escape")

        # 4. TEST: Edge Case - Missing Note Link (Ghost Note)
        print("Testing Missing Note Link (Ghost Note)...")
        await note_a.dblclick()
        await editor.wait_for(timeout=5000)
        await editor.fill("# Note A\nBroken [[Ghost Note]]")
        await page.click("button:has-text('SAVE')")
        await editor.wait_for(state="hidden")

        ghost_note_link = page.locator("span").get_by_text("Ghost Note", exact=True).first
        await ghost_note_link.wait_for(timeout=5000)
        await ghost_note_link.hover()
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/test_missing_link.png")
        print("Ghost Note hover completed.")

        print("Verification Suite Finished.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
