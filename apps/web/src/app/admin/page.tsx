import { Card, Stack, Text, Title } from '@mantine/core';
import { PageContainer } from '@/shared/ui';

export default function AdminHome() {
  return (
    <PageContainer>
      <Stack gap="lg">
        <Title order={2} c="navy.9">Admin Console</Title>
        <Card>
          <Stack gap="xs">
            <Text fw={500}>Welcome, admin.</Text>
            <Text size="sm" c="dimmed">
              Verifications queue, students, teams, tokens, judges, feedback, and settings
              arrive in Phase 5.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
}
