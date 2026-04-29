'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Center,
  Container,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconMailFast } from '@tabler/icons-react';
import { authClient } from '../../../shared/lib/auth-client.js';

/**
 * Forgot password form.
 * Allows users to request a password reset email.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);

    try {
      await authClient.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Center mih="100vh" py="xl" style={{ background: 'var(--navy-900)' }}>
        <Container size={420}>
          <Card p="xl">
            <Stack gap="md" align="center">
              <IconMailFast size={64} color="var(--navy-600)" stroke={1.5} />
              <Stack gap={2} align="center">
                <Title order={2} c="navy.9">
                  Check Your Email
                </Title>
                <Text c="dimmed" size="sm" ta="center">
                  If an account exists with that email, we've sent a password reset link. Please
                  check your inbox and spam folder.
                </Text>
              </Stack>

              <Stack gap={8} w="100%">
                <Text size="xs" c="dimmed" ta="center">
                  The reset link will expire in 1 hour.
                </Text>
                <Button
                  variant="light"
                  fullWidth
                  onClick={() => {
                    setEmail('');
                    setSubmitted(false);
                  }}
                >
                  Try Another Email
                </Button>
                <Button variant="subtle" fullWidth onClick={() => router.push('/auth/login')}>
                  Back to Login
                </Button>
              </Stack>
            </Stack>
          </Card>
        </Container>
      </Center>
    );
  }

  return (
    <Center mih="100vh" py="xl" style={{ background: 'var(--navy-900)' }}>
      <Container size={420}>
        <Card p="xl">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Stack gap={2}>
                <Title order={2} c="navy.9">
                  Forgot Password?
                </Title>
                <Text c="dimmed" size="sm">
                  Enter your email and we'll send you a link to reset your password
                </Text>
              </Stack>

              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Error"
                  color="red"
                  variant="light"
                >
                  {error}
                </Alert>
              )}

              <TextInput
                label="Email Address"
                placeholder="name@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                disabled={loading}
                required
              />

              <Button type="submit" color="navy" loading={loading} disabled={loading} fullWidth>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <Text size="sm" c="dimmed" ta="center">
                Remember your password?{' '}
                <a href="/auth/login" style={{ color: 'var(--navy-600)', textDecoration: 'none' }}>
                  Sign in
                </a>
              </Text>
            </Stack>
          </form>
        </Card>
      </Container>
    </Center>
  );
}
