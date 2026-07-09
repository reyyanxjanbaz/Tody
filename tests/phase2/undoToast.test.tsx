import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UndoProvider, useUndo } from '../../src/components/UndoToast';

function Probe() {
  const { showUndo } = useUndo();
  return (
    <div>
      <button onClick={() => showUndo('Task deleted', vi.fn())}>show</button>
      <button onClick={() => showUndo('A', vi.fn())}>show-a</button>
      <button onClick={() => showUndo('B', vi.fn())}>show-b</button>
      <button onClick={() => showUndo('C', vi.fn())}>show-c</button>
      <button onClick={() => showUndo('D', vi.fn())}>show-d</button>
    </div>
  );
}

function renderWithUndo() {
  return render(
    <UndoProvider>
      <Probe />
    </UndoProvider>,
  );
}

describe('Phase 2.8 — UndoToast', () => {
  afterEach(() => vi.useRealTimers());

  it('showUndo renders a toast with the given message', async () => {
    const user = userEvent.setup();
    renderWithUndo();
    await user.click(screen.getByText('show'));
    expect(screen.getByText('Task deleted')).toBeInTheDocument();
    expect(screen.getByText('Undo')).toBeInTheDocument();
  });

  it('clicking Undo calls onUndo and dismisses the toast', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();

    function ProbeWithUndo() {
      const { showUndo } = useUndo();
      return <button onClick={() => showUndo('Deleted', onUndo)}>trigger</button>;
    }

    render(
      <UndoProvider>
        <ProbeWithUndo />
      </UndoProvider>,
    );

    await user.click(screen.getByText('trigger'));
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    await user.click(screen.getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
    // AnimatePresence keeps the toast mounted through its exit transition.
    await waitFor(() => expect(screen.queryByText('Deleted')).not.toBeInTheDocument());
  });

  it(
    'auto-dismisses ~5s after showing (real timers — framer-motion drives the progress bar off rAF)',
    async () => {
      const user = userEvent.setup();
      renderWithUndo();
      await user.click(screen.getByText('show'));
      expect(screen.getByText('Task deleted')).toBeInTheDocument();

      await waitFor(() => expect(screen.queryByText('Task deleted')).not.toBeInTheDocument(), {
        timeout: 6500,
        interval: 100,
      });
    },
    7000,
  );

  it('caps the visible stack at 3 toasts, dropping the oldest', async () => {
    const user = userEvent.setup();
    renderWithUndo();
    await user.click(screen.getByText('show-a'));
    await user.click(screen.getByText('show-b'));
    await user.click(screen.getByText('show-c'));
    await user.click(screen.getByText('show-d'));

    // AnimatePresence keeps the dropped toast mounted through its exit transition.
    await waitFor(() => expect(screen.queryByText('A')).not.toBeInTheDocument());
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});
