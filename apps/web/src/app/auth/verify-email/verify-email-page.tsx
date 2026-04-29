'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Center,
  Container,
  Group,
  Stack,
  Text,
  Title,
  Loader,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconMailOpened } from '@tabler/icons-react';
import { authClient } from '../../../shared/lib/auth-client.js';

type VerificationState = 'loading' | 'success' | 'error' | 'invalid-token';

/**
 * Email verification page.
 * Verifies the token from the URL and marks the email as verified.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setState('invalid-token');
        setError('No verification token provided');
        return;
      }

      try {
        await authClient.verifyEmail(token);
        setState('success');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        setState('error');
        setError(message);
      }
    };

    verify();
  }, [searchParams, router]);

  return (
    <Center mih="100vh" py="xl" style={{ background: 'var(--navy-900)' }}>
      <Container size={420}>
        <Card p="xl">
          <Stack gap="md" align="center">
            {/* Loading */}
            {state === 'loading' && (
              <>
                <Loader />
                <Stack gap={4} align="center">
                  <Title order={2} c="navy.9">
                    Verifying Email
                  </Title>
                  <Text c="dimmed" size="sm" ta="center">
                    Please wait while we confirm your email address...
                  </Text>
                </Stack>
              </>
            )}

            {/* Success */}
            {state === 'success' && (
              <>
                <ThemeIcon size={80} radius="50%" color="green" variant="filled">
                  <IconCheck size={48} />
                </ThemeIcon>
                <Stack gap={4} align="center">
                  <Title order={2} c="navy.9">
                    Email Verified!
                  </Title>
                  <Text c="dimmed" size="sm" ta="center">
                    Your email has been successfully verified. Redirecting to login...
                  </Text>
                </Stack>
              </>
            )}

            {/* Error */}
            {state === 'error' && (
              <>
                <ThemeIcon size={80} radius="50%" color="red" variant="filled">
                  <IconAlertCircle size={48} />
                </ThemeIcon>
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Verification Failed"
                  color="red"
                  variant="light"
                  w="100%"
                >
                  {error}
                </Alert>
                <Button variant="light" fullWidth onClick={() => router.push('/auth/register')}>
                  Try Again
                </Button>
              </>
            )}

            {/* Invalid Token */}
            {state === 'invalid-token' && (
              <>
                <ThemeIcon size={80} radius="50%" color="orange" variant="filled">
                  <IconMailOpened size={48} />
                </ThemeIcon>
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Invalid Link"
                  color="orange"
                  variant="light"
                  w="100%"
                >
                  This verification link is invalid or has expired. Please check your email for a
                  new link.
                </Alert>
                <Button fullWidth onClick={() => router.push('/auth/register')}>
                  Register Again
                </Button>
              </>
            )}
          </Stack>
        </Card>
      </Container>
    </Center>
  );
}
