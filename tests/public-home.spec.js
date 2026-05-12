import { test, expect } from '@playwright/test'

test.describe('MarketOS Public Home', () => {
  test('PUBLIC HOME: Gäste sehen Landingpage und geschützte /app-Routen leiten zum Login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('public-shell')).toBeVisible()
    await expect(page.getByTestId('public-home-page')).toBeVisible()
    await expect(page.getByTestId('public-nav-markets')).toBeVisible()
    await expect(page.getByTestId('public-nav-vendors')).toBeVisible()
    await expect(page.getByTestId('public-nav-about')).toBeVisible()
    await expect(page.getByTestId('public-nav-login')).toBeVisible()
    await expect(page.getByTestId('public-hero-cta')).toBeVisible()
    await expect(page.getByTestId('app-authenticated')).toHaveCount(0)

    await page.goto('/app')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('login-form')).toBeVisible()
  })
})
