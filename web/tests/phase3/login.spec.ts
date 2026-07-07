import { test, expect } from '@playwright/test';
import { collectErrors, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.1 — LoginScreen', () => {
  test('renders the login form with zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await page.goto('/');
    await expect(page.getByText('ToDy')).toBeVisible();
    await expect(page.getByText('Welcome back.')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('empty submit surfaces a client-side validation error with no network call', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Email and password are required')).toBeVisible();
  });

  test('an invalid email surfaces a validation error', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('secret1');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Please enter a valid email')).toBeVisible();
  });

  test('a too-short password surfaces a validation error', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('abc');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
  });

  test('a real (stubbed) Supabase auth failure surfaces its error message', async ({ page }) => {
    await page.route(/\/auth\/v1\/token/, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      }),
    );
    await page.goto('/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('wrongpass');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Invalid login credentials')).toBeVisible({ timeout: 10_000 });
  });

  test('the Register link navigates to /register', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
});
