import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../core/context/AuthContext';
import { Button, TextField } from '../ui';

export function RegisterScreen() {
  const { register, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'var(--sp-xxxl) var(--sp-xxl)',
        paddingTop: 'calc(var(--safe-top) + var(--sp-xxxl))',
        background: 'var(--c-background)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px' }}>Create account</h1>
          <p style={{ color: 'var(--c-text-secondary)', marginTop: 4 }}>Start with a calm list.</p>
        </div>

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            clearError();
            setEmail(e.target.value);
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            clearError();
            setPassword(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && register(email, password)}
        />

        {error && <div style={{ color: '#e06767', fontSize: 14 }}>{error}</div>}

        <Button title="Create account" onPress={() => register(email, password)} loading={isLoading} />

        <div style={{ textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: 14 }}>
          Have an account?{' '}
          <Link to="/login" style={{ color: 'var(--c-text)', fontWeight: 600 }}>
            Log in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
