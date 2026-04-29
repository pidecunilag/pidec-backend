import { Button, Stack, Text, Title } from '@mantine/core';
import { IconInbox, type IconProps } from '@tabler/icons-react';
import { type ComponentType, type ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ComponentType<IconProps>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void } | ReactNode;
}

/**
 * Standard empty state — used wherever a list or section has no data.
 * Per Design System §8 the empty-state icon size is 64px, colour grey-200.
 */
export const EmptyState = ({
  icon: Icon = IconInbox,
  title,
  description,
  action,
}: EmptyStateProps) => {
  return (
    <Stack align="center" gap="md" py="xl" role="status">
      <Icon size={64} aria-hidden="true" color="var(--grey-200)" />
      <Title order={3} ta="center">
        {title}
      </Title>
      {description ? (
        <Text c="dimmed" ta="center" maw={420}>
          {description}
        </Text>
      ) : null}
      {action
        ? typeof action === 'object' && action !== null && 'label' in action
          ? <Button onClick={(action as { onClick: () => void }).onClick}>
              {(action as { label: string }).label}
            </Button>
          : action
        : null}
    </Stack>
  );
};
