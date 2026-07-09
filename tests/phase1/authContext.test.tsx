import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../src/core/context/ThemeContext';
import { AuthProvider, useAuth } from '../../src/core/context/AuthContext';
import { supabase } from '../../src/core/lib/supabase';
import { saveTasks } from '../../src/core/utils/storage';

function Probe() {
  const { user, isLoading, error, login, register, logout, clearError } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button onClick={() => login('a@b.com', 'secret1')}>login</button>
      <button onClick={() => register('a@b.com', 'secret1')}>register</button>
      <button onClick={() => login('bad', 'x')}>login-bad-email</button>
      <button onClick={() => login('a@b.com', 'x')}>login-short-pw</button>
      <button onClick={logout}>logout</button>
      <button onClick={clearError}>clear</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('Phase 1.8 — AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as any);
  });

  it('client-side validates email format with zero network calls', async () => {
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login-bad-email'));

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('valid email'));
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('client-side validates password length (>= 6) with zero network calls', async () => {
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login-short-pw'));

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('6 characters'));
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('login() calls the (mocked) supabase client with normalized email', async () => {
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login'));

    await waitFor(() =>
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'secret1',
      }),
    );
  });

  it('surfaces a supabase auth error via SET_ERROR', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    } as any);
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Invalid login credentials'));
  });

  it('register() surfaces "check your email" when a session is not returned (email confirmation pending)', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    } as any);
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('register'));

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('confirmation link'));
  });

  it('clearError resets the error message', async () => {
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await user.click(screen.getByText('login-bad-email'));
    await waitFor(() => expect(screen.getByTestId('error')).not.toHaveTextContent(''));

    await user.click(screen.getByText('clear'));
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  it('logout() signs out, wipes local storage, and dispatches LOGOUT', async () => {
    await saveTasks([{ id: 't1' }]);
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('logout'));

    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());
    expect(localStorage.getItem('@tody_tasks')).toBeNull();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('restores an existing session on mount', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'existing@user.com' } } },
    } as any);

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('existing@user.com'));
  });
});
