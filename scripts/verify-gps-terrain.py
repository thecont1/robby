import asyncio
import json
from playwright.async_api import async_playwright


async def main() -> None:
    result = {"selected": False, "gps_state": None, "terrain_available": False, "consent_button": False, "canvas": False, "errors": []}
    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 1100})
        page.on("pageerror", lambda error: result["errors"].append(str(error)))
        page.on("console", lambda message: result["errors"].append(message.text) if message.type == "error" else None)
        await page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        await page.wait_for_timeout(1600)

        specimen = page.locator("button").filter(has_text="MS202303-DerSpiegel0366.jpg")
        result["selected"] = await specimen.count() > 0
        await specimen.click()
        await page.wait_for_timeout(600)

        evidence_tab = page.locator("button").filter(has_text="Embedded evidence")
        await evidence_tab.click()
        inspect = page.locator("button").filter(has_text="Inspect evidence")
        if await inspect.count():
            await inspect.click()
            await page.wait_for_timeout(2500)

        result["gps_state"] = await page.locator(".embedded-evidence-row").filter(has_text="GPS").inner_text()
        consent = page.locator("button").filter(has_text="Show generalized terrain")
        result["terrain_available"] = await consent.count() > 0
        result["consent_button"] = result["terrain_available"]
        if result["terrain_available"]:
            await consent.click()
            await page.wait_for_timeout(1200)
            result["canvas"] = await page.locator(".generalized-terrain canvas").count() == 1
            result["terrain_text"] = await page.locator(".terrain-evidence-block").inner_text()
        result["console_errors"] = result.pop("errors")
        print(json.dumps(result, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
