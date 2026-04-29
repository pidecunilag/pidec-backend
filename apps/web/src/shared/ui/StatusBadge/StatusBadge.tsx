import { Badge, type BadgeProps, type DefaultMantineColor } from '@mantine/core';
import {
  IconAlertTriangle,
  IconBan,
  IconCheck,
  IconClock,
  IconShieldCheck,
  IconTrophy,
  IconX,
  type IconProps,
} from '@tabler/icons-react';
import { type ComponentType } from 'react';

type StatusKind =
  | 'verified'
  | 'pending'
  | 'rejected'
  | 'flagged'
  | 'suspended'
  | 'submitted'
  | 'under_review'
  | 'feedback_published'
  | 'advanced'
  | 'disqualified'
  | 'active'
  | 'expired'
  | 'accepted'
  | 'declined';

interface StatusBadgeConfig {
  label: string;
  color: DefaultMantineColor;
  icon: ComponentType<IconProps>;
}

const STATUS_CONFIG: Record<StatusKind, StatusBadgeConfig> = {
  verified: { label: 'Verified', color: 'green', icon: IconShieldCheck },
  pending: { label: 'Pending', color: 'yellow', icon: IconClock },
  rejected: { label: 'Rejected', color: 'red', icon: IconX },
  flagged: { label: 'Flagged', color: 'yellow', icon: IconAlertTriangle },
  suspended: { label: 'Suspended', color: 'red', icon: IconBan },
  submitted: { label: 'Submitted', color: 'navy', icon: IconCheck },
  under_review: { label: 'Under Review', color: 'navy', icon: IconClock },
  feedback_published: { label: 'Feedback Available', color: 'green', icon: IconCheck },
  advanced: { label: 'Advanced', color: 'gold', icon: IconTrophy },
  disqualified: { label: 'Disqualified', color: 'red', icon: IconBan },
  active: { label: 'Active', color: 'green', icon: IconCheck },
  expired: { label: 'Expired', color: 'gray', icon: IconClock },
  accepted: { label: 'Accepted', color: 'green', icon: IconCheck },
  declined: { label: 'Declined', color: 'gray', icon: IconX },
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  status: StatusKind;
  /** Override the auto label (e.g. for stage-specific text). */
  label?: string;
}

/**
 * Status pill with paired icon (per Design System §7.4 — every status badge
 * pairs an icon and label, never colour alone — accessibility requirement).
 */
export const StatusBadge = ({ status, label, ...rest }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge
      color={config.color}
      leftSection={<Icon size={14} aria-hidden="true" />}
      variant="light"
      radius="sm"
      {...rest}
    >
      {label ?? config.label}
    </Badge>
  );
};
