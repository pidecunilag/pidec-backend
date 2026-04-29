import { Container, type ContainerProps } from '@mantine/core';
import { type ReactNode } from 'react';

export interface PageContainerProps extends Omit<ContainerProps, 'children'> {
  children: ReactNode;
}

/**
 * Standard page-level wrapper. Always uses Mantine's Container — never set
 * max-width on page wrappers manually (Design System §6).
 *
 * Default size 'lg' (~1200px) matches the breakpoint table in §6.
 */
export const PageContainer = ({ size = 'lg', py = 'xl', children, ...rest }: PageContainerProps) => {
  return (
    <Container size={size} py={py} {...rest}>
      {children}
    </Container>
  );
};
