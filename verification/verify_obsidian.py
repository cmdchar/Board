from playwright.sync_api import sync_playwright, expect
import time
import os

def verify_obsidian_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"BROWSER ERROR: {exc}"))

        try:
            print("Navigating to landing page...")
            page.goto("http://localhost:5173/")
            time.sleep(2)

            print("Registering user...")
            page.click("text=Get started free →")
            page.get_by_placeholder("Your name").fill("Tester")
            page.get_by_placeholder("Email address").fill(f"tester_{int(time.time())}@example.com")
            page.get_by_placeholder("Password (min 6 chars)").fill("password123")
            page.locator("form").get_by_role("button", name="Create Account").click()

            print("Waiting for dashboard...")
            page.wait_for_selector("text=NEW BOARD", timeout=15000)

            print("Creating a board...")
            page.get_by_placeholder("Board name...").fill("Obsidian Test Board")
            page.click("button:has-text('Create ->')")

            print("Waiting for editor...")
            page.wait_for_selector("text=Inspector", timeout=20000)
            print("Editor loaded.")

            # Click Skip Onboarding if present
            skip = page.locator("text=Skip")
            if skip.count() > 0:
                print("Skipping onboarding...")
                skip.click()
                time.sleep(1)

            # Select Note tool
            print("Selecting Note tool...")
            # Try to find the note button in the LeftToolbar
            note_btn = page.locator("button[title*='Add Note']")
            note_btn.click()
            print("Note tool selected.")

            print("Adding note to canvas...")
            # Click in an empty area top-left
            page.mouse.click(150, 150)
            time.sleep(2)

            # Take screenshot
            page.screenshot(path="verification/canvas_after_click.png")

            print("Searching for note node...")
            # The node should be rendered by NodeRenderer
            note_handle = page.locator('[data-node-type="note"]')

            if note_handle.count() == 0:
                print("Note node not found by attribute. Checking for any nodes...")
                all_nodes = page.locator('[data-node="1"]')
                print(f"Total nodes found: {all_nodes.count()}")
                for i in range(all_nodes.count()):
                     print(f"Node {i} type: {all_nodes.nth(i).get_attribute('data-node-type')}")

            expect(note_handle.first).to_be_visible(timeout=10000)
            print("Note node found and visible!")

            # Double click to edit - it's already selected but dblclick enters edit mode
            note_handle.first.dblclick()
            time.sleep(1)

            print("Filling note content...")
            # NoteNode uses a textarea in edit mode. Scope it to the note node.
            page.locator('[data-node-type="note"] textarea').fill("# Obsidian Demo\n\nThis platform now supports **Markdown** and [[Bi-directional Links]].")

            # Click SAVE button
            page.click("button:has-text('SAVE')")
            print("Note saved.")

            # Verify Markdown rendering (h1)
            expect(page.locator('h1:has-text("Obsidian Demo")')).to_be_visible()
            print("Markdown rendering verified.")

            print("Opening Knowledge Base...")
            # Open Right Panel if closed
            # Right panel might have a trigger
            kb_trigger = page.locator("button:has-text('KNOWLEDGE BASE')")
            if kb_trigger.count() > 0:
                kb_trigger.click()
                time.sleep(1)

            # Verify note title in KB
            # It might be in an accordion
            expect(page.get_by_text("Obsidian Demo", exact=True).first).to_be_visible()
            print("Knowledge Base verified.")

            # Create a second note that links to the first one
            print("Adding second note with backlink...")
            page.locator("button[title*='Add Note']").click()
            page.mouse.click(600, 150)
            time.sleep(1)

            second_note = page.locator('[data-node-type="note"]').nth(1)
            second_note.dblclick()
            time.sleep(1)

            page.locator('[data-node-type="note"] textarea').fill("# Second Note\n\nReferencing [[Obsidian Demo]] here.")
            page.click("button:has-text('SAVE')")
            print("Second note saved.")

            # Click on the first note to see its local graph in KB
            print("Selecting first note...")
            page.locator('[data-node-type="note"]').first.click()
            time.sleep(1)

            # Check Local Graph in KB
            print("Verifying Local Graph...")
            expect(page.get_by_text("Active Note Local Graph")).to_be_visible()
            expect(page.get_by_text("← Second Note")).to_be_visible()
            print("Local Graph / Backlinks verified.")

            # Test Command Palette
            print("Testing Command Palette...")
            page.keyboard.press("Control+k")
            expect(page.get_by_placeholder("Type a command or search nodes...")).to_be_visible()
            print("Command Palette opened.")

            page.get_by_placeholder("Type a command or search nodes...").fill("Select Tool")
            expect(page.get_by_text("Select Tool", exact=True)).to_be_visible()
            page.keyboard.press("Enter")
            print("Command Palette action executed.")

            # Take final screenshot
            time.sleep(1)
            page.screenshot(path="verification/obsidian_final.png")
            print("Success! Screenshots saved.")

        except Exception as e:
            print(f"Error during verification: {e}")
            page.screenshot(path="verification/error_debug.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_obsidian_features()
