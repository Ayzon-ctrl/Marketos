import { test, expect } from '@playwright/test'

test.describe('MarketOS Public Vendors', () => {
  test('PUBLIC VENDORS: Öffentliche Händler-Seite lädt und bleibt ohne Login erreichbar', async ({ page }) => {
    await page.goto('/vendors')
    await expect(page.getByTestId('public-vendors-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Händler entdecken/i })).toBeVisible()
    await expect(page.getByTestId('public-vendor-search')).toBeVisible()

    await expect(
      page.locator('[data-testid="public-vendor-card"], [data-testid="public-page-empty"], [data-testid="public-page-error"]').first()
    ).toBeVisible()
  })
})
