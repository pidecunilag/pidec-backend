import { Card, Stack, Text, Title } from '@mantine/core';
import { PageContainer } from '@/shared/ui';

export default function JudgeHome() {
  return (
    <PageContainer>
      <Stack gap="lg">
        <Title order={2} c="navy.9">Judge Portal</Title>
        <Card>
          <Stack gap="xs">
            <Text fw={500}>Welcome, judge.</Text>
            <Text size="sm" c="dimmed">
              Stage 1 representative selection and Stage 2 scoring arrive in Phase 6.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
}
