import { Card, Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  // Phase 3 will mount the real login form (Mantine useForm + Zod LoginSchema).
  // This stub exists so the auth route group is reachable end-to-end and
  // protected routes redirect here correctly.
  return (
    <Card maw={420} w="100%" padding="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} c="navy.9">Welcome back</Title>
          <Text c="dimmed" size="sm">
            Sign in to your PIDEC 1.0 account to continue.
          </Text>
        </Stack>
        <Text size="sm" c="dimmed">
          Login form arrives in Phase 3.
        </Text>
      </Stack>
    </Card>
  );
}
