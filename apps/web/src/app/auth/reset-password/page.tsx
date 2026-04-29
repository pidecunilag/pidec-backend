'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Center,
  Container,
  Group,
  PasswordInput,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
  Badge,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { authClient } from '../../../shared/lib/auth-client.js';

/**
 * Password reset form.
 * Allows users to set a new password using a token from the reset email.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const getPasswordStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 10;
    if (/[a-z]/.test(pwd)) strength += 10;
    if (/[0-9]/.test(pwd)) strength += 15;
    if (/[!@#$%^&*]/.test(pwd)) strength += 15;
    return Math.min(strength, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset token is missing. Please check your email link.');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Za-z]/.test(password)) {
      setError('Password must contain at least one letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authClient.resetPassword(token, password);
      router.push('/auth/login?reset=success');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Password reset failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Center mih="100vh" py="xl" style={{ background: 'var(--navy-900)' }}>
        <Container size={420}>
          <Card p="xl">
            <Stack gap="md">
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Invalid Link"
                color="red"
                variant="light"
              >
                This password reset link is invalid or has expired. Please request a new reset link.
              </Alert>
              <Button fullWidth onClick={() => router.push('/auth/forgot-password')}>
                Request New Link
              </Button>
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
                  Reset Password
                </Title>
                <Text c="dimmed" size="sm">
                  Enter a new password for your account
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

              <Stack gap={6}>
                <PasswordInput
                  label="New Password"
                  placeholder="Enter a strong password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.currentTarget.value);
                    setPasswordStrength(getPasswordStrength(e.currentTarget.value));
                  }}
                  disabled={loading}
                  required
                />
                {password && (
                  <>
                    <Progress
                      value={passwordStrength}
                      size="sm"
                      color={
                        passwordStrength < 50 ? 'red' : passwordStrength < 80 ? 'yellow' : 'green'
                      }
                    />
                    <Text size="xs" c="dimmed">
                      Strength:{' '}
                      {passwordStrength < 50 ? 'Weak' : passwordStrength < 80 ? 'Good' : 'Strong'}
                    </Text>
                  </>
                )}
              </Stack>

              <PasswordInput
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                disabled={loading}
                required
              />

              <Card bg="var(--navy-50)" p="sm" radius="md">
                <Stack gap={6}>
                  <Text size="xs" fw={600} c="navy.9">
                    Password Requirements:
                  </Text>
                  <Group gap={6} wrap="wrap">
                    <Badge
                      size="sm"
                      variant={password.length >= 8 ? 'filled' : 'default'}
                      color={password.length >= 8 ? 'green' : 'gray'}
                      leftSection={password.length >= 8 ? <IconCheck size={12} /> : null}
                    >
                      8+ characters
                    </Badge>
                    <Badge
                      size="sm"
                      variant={/[A-Za-z]/.test(password) ? 'filled' : 'default'}
                      color={/[A-Za-z]/.test(password) ? 'green' : 'gray'}
                      leftSection={/[A-Za-z]/.test(password) ? <IconCheck size={12} /> : null}
                    >
                      Letter
                    </Badge>
                    <Badge
                      size="sm"
                      variant={/[0-9]/.test(password) ? 'filled' : 'default'}
                      color={/[0-9]/.test(password) ? 'green' : 'gray'}
                      leftSection={/[0-9]/.test(password) ? <IconCheck size={12} /> : null}
                    >
                      Number
                    </Badge>
                  </Group>
                </Stack>
              </Card>

              <Button type="submit" color="navy" loading={loading} disabled={loading} fullWidth>
                {loading ? 'Resetting Password...' : 'Reset Password'}
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
