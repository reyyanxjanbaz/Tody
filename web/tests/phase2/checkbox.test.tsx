import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../../src/ui/Checkbox';
import { ThemeProvider } from '../../src/core/context/ThemeContext';

function renderCheckbox(props: Partial<React.ComponentProps<typeof Checkbox>> = {}) {
  return render(
    <ThemeProvider>
      <Checkbox checked={false} onToggle={() => {}} {...props} />
    </ThemeProvider>,
  );
}

describe('Phase 2.4 — Checkbox', () => {
  afterEach(() => vi.restoreAllMocks());

  it('click calls onToggle when unlocked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderCheckbox({ onToggle });
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('locked click does not call onToggle and fires a warning haptic instead', async () => {
    const onToggle = vi.fn();
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);
    const user = userEvent.setup();
    renderCheckbox({ onToggle, locked: true });
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox'));
    expect(onToggle).not.toHaveBeenCalled();
    expect(vibrateSpy).toHaveBeenCalled();
  });

  it('aria-checked reflects the checked prop', async () => {
    renderCheckbox({ checked: true });
    await waitFor(() => expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true'));
  });

  it('unchecked renders aria-checked="false"', async () => {
    renderCheckbox({ checked: false });
    await waitFor(() => expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false'));
  });
});
