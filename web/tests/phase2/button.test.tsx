import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../src/ui/Button';

describe('Phase 2.3 — Button', () => {
  it.each(['primary', 'secondary', 'ghost'] as const)('renders the %s variant with its title', (variant) => {
    render(<Button title="Continue" onPress={() => {}} variant={variant} />);
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('loading replaces the title with a spinner and blocks the press', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Button title="Save" onPress={onPress} loading />);
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled blocks the press without loading', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Button title="Save" onPress={onPress} disabled />);
    await user.click(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires onPress when enabled', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Button title="Save" onPress={onPress} />);
    await user.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
