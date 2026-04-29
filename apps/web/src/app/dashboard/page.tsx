import { Card, Stack, Text, Title } from '@mantine/core';

export default function DashboardHome() {
  return (
    <Stack gap="lg">
      <Title order={2} c="navy.9">Dashboard</Title>
      <Card>
        <Stack gap="xs">
          <Text fw={500}>Welcome to PIDEC 1.0.</Text>
          <Text size="sm" c="dimmed">
            Stage panel, team summary, and notifications arrive in Phase 4.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
