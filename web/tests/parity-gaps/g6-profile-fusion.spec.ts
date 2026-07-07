import { test, expect } from '@playwright/test';
import { mkTask, seedApp, seedSession, stubNetwork } from '../helpers/seed';

/**
 * G6 — Profile fusion section (native `src/components/profile/PerformanceFusionSection.tsx`).
 * Native Profile has a full "PERFORMANCE STORY" narrative section — a hero
 * score, a momentum/tone headline, an estimate-vs-reality bar comparison, and
 * a pace graph woven into prose. Web's Profile condenses this to a plain
 * 3-cell stat grid (Completed / Total tasks / Time invested). EXPECTED TO
 * FAIL until the fusion narrative section is ported.
 */
test('Profile renders the PERFORMANCE STORY narrative section, not just a bare stat grid', async ({ page }) => {
  await stubNetwork(page);
  await seedSession(page, 'fusion@example.com');
  await seedApp(page, {
    tasks: Array.from({ length: 12 }, (_, i) =>
      mkTask({ id: `t${i}`, title: `Task ${i}`, completedAt: Date.now(), est: 30, act: 30 }),
    ),
    path: '/profile',
  });

  await expect(page.getByText('PERFORMANCE STORY')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Your operating pattern')).toBeVisible();
});
