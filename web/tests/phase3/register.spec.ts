import { test, expect } from '@playwright/test';
import { collectErrors, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.2 — RegisterScreen', () => {
  test('renders the register form with zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('client-side validation mirrors Login (email + password rules)', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Email and password are required')).toBeVisible();
  });

  test('email-confirmation-pending: signUp returning a user with no session surfaces the confirmation copy', async ({ page }) => {
    await page.route(/\/auth\/v1\/signup/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'u1', email: 'new@example.com', confirmation_sent_at: new Date().toISOString() }),
      }),
    );
    await page.goto('/register');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel('Password').fill('secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Check your email for a confirmation link')).toBeVisible({ timeout: 10_000 });
  });

  test('the Log in link navigates back to /login', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/register');
    await page.getByRole('link', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
