import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, Sheet } from '../../src/ui/Modal';

describe('Phase 2.5 — Modal / Sheet', () => {
  it('Modal renders its children into document.body via a portal when open', () => {
    render(
      <Modal open onClose={() => {}}>
        <div>modal content</div>
      </Modal>,
    );
    expect(screen.getByText('modal content')).toBeInTheDocument();
    expect(document.body).toContainElement(screen.getByText('modal content'));
  });

  it('Modal renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <div>hidden content</div>
      </Modal>,
    );
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('Modal: clicking the backdrop closes it, clicking the content does not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <div data-testid="card">card</div>
      </Modal>,
    );
    await user.click(screen.getByTestId('card'));
    expect(onClose).not.toHaveBeenCalled();

    // The backdrop is the outer motion.div — click it directly (not the card).
    await user.click(screen.getByText('card').parentElement!.parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it('Sheet renders a drag handle bar above its content', () => {
    render(
      <Sheet open onClose={() => {}}>
        <div>sheet body</div>
      </Sheet>,
    );
    expect(screen.getByText('sheet body')).toBeInTheDocument();
    // The handle is the first child of the sheet panel, before the content.
    const panel = screen.getByText('sheet body').parentElement!;
    expect(panel.firstElementChild).not.toBeNull();
    expect(panel.firstElementChild).not.toBe(screen.getByText('sheet body'));
  });

  it('Sheet: clicking the backdrop closes it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Sheet open onClose={onClose}>
        <div data-testid="sheet-card">sheet</div>
      </Sheet>,
    );
    await user.click(screen.getByTestId('sheet-card').parentElement!.parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  // Drag-past-threshold-closes relies on framer-motion's pointer-capture drag
  // gesture recognition, which needs real layout geometry jsdom doesn't
  // provide reliably — that behavior is covered for real in the Phase 3
  // Playwright specs (a real Chromium layout engine) instead of faked here.
});
