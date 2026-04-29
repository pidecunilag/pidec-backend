import { Card, Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Register' };

export default function RegisterPage() {
  // Phase 3 will mount the registration form (multi-step: account, document
  // upload, processing screen) wired to RegisterSchema.
  return (
    <Card maw={520} w="100%" padding="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} c="navy.9">Create your PIDEC account</Title>
          <Text c="dimmed" size="sm">
            Engineering students only. Verification is automated via document review.
          </Text>
        </Stack>
        <Text size="sm" c="dimmed">
          Registration form arrives in Phase 3.
        </Text>
      </Stack>
    </Card>
  );
}
