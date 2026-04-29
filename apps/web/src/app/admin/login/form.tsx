'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  Center,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { authClient } from '../../../shared/lib/auth-client.js';

/**
 * Admin login form component.
 * Handles email/password validation and JWT-based authentication.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate inputs
      if (!email.trim()) {
        setError('Email is required');
        setLoading(false);
        return;
      }
      if (!password) {
        setError('Password is required');
        setLoading(false);
        return;
      }

      // Call login endpoint
      const result = await authClient.login(email, password);

      // Verify user is admin
      if (result.user.role !== 'admin') {
        setError('Only administrators can access the admin console');
        setLoading(false);
        return;
      }

      // Success — redirect to admin dashboard
      router.replace('/admin');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(
        message.includes('401') || message.includes('Invalid')
          ? 'Invalid email or password'
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh" p="md" style={{ background: 'var(--navy-900)' }}>
      <Card maw={420} w="100%" padding="xl">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Header */}
            <Stack gap={4}>
              <Title order={2} c="navy.9">
                Admin Console
              </Title>
              <Text c="dimmed" size="sm">
                Restricted access. Authorised personnel only.
              </Text>
            </Stack>

            {/* Error Alert */}
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Login Failed"
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            {/* Form Fields */}
            <Box>
              <TextInput
                label="Email"
                placeholder="admin@pidec.com.ng"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                disabled={loading}
                required
              />
            </Box>

            <Box>
              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                disabled={loading}
                required
              />
            </Box>

            {/* Submit Button */}
            <Group justify="flex-end">
              <Button type="submit" color="navy" loading={loading} disabled={loading} w="100%">
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </Group>

            {/* Help Text */}
            <Text size="xs" c="dimmed" ta="center">
              Credentials seeded during platform initialization.
              <br />
              Contact platform admin if you need access.
            </Text>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
