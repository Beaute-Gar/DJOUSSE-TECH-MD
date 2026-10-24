#!/usr/bin/env python3
"""Rend la carte sociale HTML en PNG (nécessite Playwright et Chromium)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "og-card.html"
OUTPUT = ROOT / "website" / "assets" / "og-image.png"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.goto(SOURCE.as_uri(), wait_until="load")
    page.screenshot(path=str(OUTPUT), full_page=False)
    browser.close()

print(f"Visuel Open Graph créé : {OUTPUT}")
