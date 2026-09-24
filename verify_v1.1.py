from playwright.sync_api import sync_playwright
import os

def run_acceptance_tests(page):
    # 1. Load application & check JSON loading
    page.goto("http://localhost:8000/index.html")
    page.wait_for_timeout(1000)
    print("Scenario A.1: Load Page successful.")

    # 2. Search for a vehicle (e.g., Porsche)
    page.locator("#search-input").fill("Porsche")
    page.wait_for_timeout(500)
    print("Scenario A.2: Search text entered.")

    # 3. Apply brand filter
    page.locator("#filter-brand").select_option("Porsche")
    page.wait_for_timeout(500)
    print("Scenario A.3: Brand filter applied.")

    # 4. Sort by price Low -> High
    page.locator("#catalog-sort").select_option("price-asc")
    page.wait_for_timeout(500)
    print("Scenario A.4: Sorting applied.")

    # 5. Open details of first matching card
    page.locator(".btn-card-action").first.click()
    page.wait_for_timeout(500)
    print("Scenario A.5: Details modal opened.")

    # 6. Favorite from modal
    page.locator("#detail-modal-body .btn-card-fav").first.click()
    page.wait_for_timeout(500)
    print("Scenario A.6: Favorited from detail modal.")

    # 7. Add to comparison
    page.locator("#detail-modal-body .btn-outline").first.click()
    page.wait_for_timeout(500)
    print("Scenario A.7: Added to compare list.")

    # 8. Close modal using ESC key
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    print("Scenario A.8: Modal closed using Escape.")

    # 9. Verify Favorites SPA View
    page.locator(".nav-btn[data-view='favorites']").click()
    page.wait_for_timeout(1000)
    print("Scenario A.9: Switched to Favorites view successfully.")

    # Take screenshot of Favorites View
    page.screenshot(path="/home/jules/verification/screenshots/verification_favorites_view.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_acceptance_tests(page)
        finally:
            context.close()
            browser.close()
