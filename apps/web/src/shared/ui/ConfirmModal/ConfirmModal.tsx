'use client';

import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { type ReactNode } from 'react';

export interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use 'red' for destructive actions (delete, disqualify). */
  intent?: 'navy' | 'red' | 'gold';
  loading?: boolean;
}

/**
 * Standard confirmation modal — use for ALL destructive actions per the
 * design system "Button Rules": "Danger buttons require a confirmation
 * modal before action executes."
 *
 * Single-purpose: confirmations only. Forms go in their own modals/pages.
 */
export const ConfirmModal = ({
  opened,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  intent = 'navy',
  loading = false,
}: ConfirmModalProps) => {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="filled"
            color={intent === 'red' ? 'red' : intent === 'gold' ? 'gold.7' : 'navy.8'}
            onClick={() => void onConfirm()}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
