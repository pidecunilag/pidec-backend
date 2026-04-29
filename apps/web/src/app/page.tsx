import {
  Accordion,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBolt,
  IconChecklist,
  IconDeviceMobile,
  IconSchool,
  IconTimeline,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { PageContainer, PublicShell } from '@/shared/ui';
import { ROUTES } from '@/shared/config/routes';

const STAGES = [
  {
    id: '1',
    title: 'Stage 1: Proposal Round',
    detail:
      'Teams submit structured engineering proposals. One representative team is selected per department.',
  },
  {
    id: '2',
    title: 'Stage 2: Build and Video Review',
    detail:
      'Department representatives submit a demo video and technical documentation for judge scoring.',
  },
  {
    id: '3',
    title: 'Grand Finale',
    detail: 'Top teams present their final solution live at the Faculty event finale.',
  },
] as const;

const DEPARTMENTS = [
  'Chemical Engineering',
  'Civil and Environmental Engineering',
  'Computer Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Metallurgical and Materials Engineering',
  'Petroleum and Gas Engineering',
  'Systems Engineering',
  'Surveying and Geoinformatics Engineering',
  'Biomedical Engineering',
] as const;

const FAQ = [
  {
    question: 'Who can register for PIDEC 1.0?',
    answer:
      'Only verified engineering students are eligible. Registration includes matric validation and document verification.',
  },
  {
    question: 'How many people can be in a team?',
    answer:
      'Each team must have 3 to 6 members from the same department, including the team leader.',
  },
  {
    question: 'Can we edit a submission after sending it?',
    answer:
      'No. Submissions are locked after confirmation. Admin can unlock only for an authorised resubmission case.',
  },
  {
    question: 'How is feedback released?',
    answer:
      'Judges submit scores first, then admin publishes feedback. Teams see feedback only after publish.',
  },
] as const;

export default function LandingPage() {
  return (
    <PublicShell signupOpen={false}>
      <Box
        component="section"
        style={{
          background:
            'linear-gradient(180deg, var(--navy-50) 0%, var(--white) 64%), radial-gradient(circle at 86% 14%, var(--gold-50) 0%, transparent 36%)',
        }}
      >
        <PageContainer py="var(--space-8)">
          <Stack gap="xl" align="center" py="xl">
            <Badge color="gold" variant="filled" size="lg" c="navy.9">
              University of Lagos Engineering Society
            </Badge>
            <Stack gap="sm" align="center" maw={860}>
              <Title order={1} ta="center" c="navy.9" style={{ fontSize: 'var(--text-display)' }}>
                PIDEC 1.0 Competition Platform
              </Title>
              <Text size="lg" ta="center" c="dimmed" maw={760}>
                A secure, mobile-first platform for registration, team management, staged
                submissions, and transparent competition progression across engineering departments.
              </Text>
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" w="100%" maw={920}>
              <Paper withBorder radius="md" p="md" bg="var(--white)">
                <Group justify="space-between">
                  <Text fw={600}>Departments</Text>
                  <ThemeIcon color="navy" variant="light" size="md" radius="xl">
                    <IconSchool size={16} />
                  </ThemeIcon>
                </Group>
                <Text c="navy.8" fw={800} style={{ fontSize: 'var(--text-h2)' }}>
                  10
                </Text>
              </Paper>

              <Paper withBorder radius="md" p="md" bg="var(--white)">
                <Group justify="space-between">
                  <Text fw={600}>Competition Stages</Text>
                  <ThemeIcon color="navy" variant="light" size="md" radius="xl">
                    <IconTimeline size={16} />
                  </ThemeIcon>
                </Group>
                <Text c="navy.8" fw={800} style={{ fontSize: 'var(--text-h2)' }}>
                  3
                </Text>
              </Paper>

              <Paper withBorder radius="md" p="md" bg="var(--white)">
                <Group justify="space-between">
                  <Text fw={600}>Platform Capacity</Text>
                  <ThemeIcon color="navy" variant="light" size="md" radius="xl">
                    <IconUsers size={16} />
                  </ThemeIcon>
                </Group>
                <Text c="navy.8" fw={800} style={{ fontSize: 'var(--text-h2)' }}>
                  3,000+
                </Text>
              </Paper>
            </SimpleGrid>

            <Group gap="sm">
              <Button
                component={Link}
                href={ROUTES.LOGIN}
                size="md"
                variant="filled"
                color="navy.8"
                leftSection={<IconArrowRight size={16} />}
              >
                Sign in
              </Button>
              <Button
                component={Link}
                href={ROUTES.STAGES}
                size="md"
                variant="outline"
                color="navy.8"
              >
                Explore stages
              </Button>
            </Group>
          </Stack>
        </PageContainer>
      </Box>

      <PageContainer id="about" py="var(--space-7)">
        <Grid gutter="xl" align="stretch">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md">
              <Text tt="uppercase" fw={700} c="gold.8" size="sm">
                About PIDEC 1.0
              </Text>
              <Title order={2} c="navy.9">
                Engineering Competition, Structured for Real Delivery
              </Title>
              <Text c="dimmed">
                PIDEC replaces manual coordination with a controlled workflow across registration,
                verification, team composition, submissions, and evaluation.
              </Text>
              <Text c="dimmed">
                Every step is auditable, stage-aware, and built for reliability under real student
                usage conditions.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card h="100%" withBorder radius="md" bg="var(--navy-50)">
              <Stack gap="md">
                <Group wrap="nowrap">
                  <ThemeIcon size="lg" radius="xl" color="navy" variant="filled">
                    <IconChecklist size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Verified registration and gated access</Text>
                </Group>
                <Group wrap="nowrap">
                  <ThemeIcon size="lg" radius="xl" color="navy" variant="filled">
                    <IconBolt size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Fast APIs and competition-safe workflows</Text>
                </Group>
                <Group wrap="nowrap">
                  <ThemeIcon size="lg" radius="xl" color="navy" variant="filled">
                    <IconDeviceMobile size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Mobile-first interface for campus networks</Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </PageContainer>

      <Box id="stages" component="section" bg="var(--grey-50)">
        <PageContainer py="var(--space-7)">
          <Stack gap="lg">
            <Group justify="space-between" align="end">
              <Stack gap={4}>
                <Text tt="uppercase" fw={700} c="gold.8" size="sm">
                  Competition Stages
                </Text>
                <Title order={2} c="navy.9">
                  Stage 1 to Grand Finale
                </Title>
              </Stack>
              <Badge color="navy" variant="light" size="lg">
                Active stage managed by admin
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {STAGES.map((stage) => (
                <Card key={stage.id} withBorder radius="md" h="100%" bg="var(--white)">
                  <Stack gap="sm" h="100%">
                    <Group justify="space-between" align="start">
                      <Badge color="navy" variant="filled" radius="sm">
                        Stage {stage.id}
                      </Badge>
                      <ThemeIcon color="gold" variant="light" radius="xl" size="md">
                        <IconTrophy size={15} />
                      </ThemeIcon>
                    </Group>
                    <Title order={3} c="navy.9">
                      {stage.title}
                    </Title>
                    <Text c="dimmed" size="sm">
                      {stage.detail}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </PageContainer>
      </Box>

      <PageContainer id="departments" py="var(--space-7)">
        <Stack gap="lg">
          <Stack gap={4}>
            <Text tt="uppercase" fw={700} c="gold.8" size="sm">
              Participating Departments
            </Text>
            <Title order={2} c="navy.9">
              Faculty-Wide Representation
            </Title>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {DEPARTMENTS.map((dept) => (
              <Paper key={dept} withBorder radius="md" p="md" bg="var(--white)">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="navy" variant="light" radius="xl" size="md">
                    <IconSchool size={16} />
                  </ThemeIcon>
                  <Text fw={500}>{dept}</Text>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </PageContainer>

      <Box id="faq" component="section" bg="var(--navy-50)">
        <PageContainer py="var(--space-7)">
          <Stack gap="lg">
            <Stack gap={4}>
              <Text tt="uppercase" fw={700} c="gold.8" size="sm">
                FAQ
              </Text>
              <Title order={2} c="navy.9">
                Common Questions
              </Title>
            </Stack>
            <Accordion radius="md" variant="separated">
              {FAQ.map((item) => (
                <Accordion.Item key={item.question} value={item.question}>
                  <Accordion.Control>{item.question}</Accordion.Control>
                  <Accordion.Panel>
                    <Text c="dimmed" size="sm">
                      {item.answer}
                    </Text>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        </PageContainer>
      </Box>

      <PageContainer py="var(--space-7)">
        <Card
          radius="md"
          withBorder
          p="xl"
          style={{
            background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 100%)',
          }}
        >
          <Stack gap="md" align="center">
            <Title order={3} c="white" ta="center">
              Ready to Join PIDEC 1.0?
            </Title>
            <Text c="var(--gold-50)" ta="center" maw={620}>
              Sign in to access your dashboard, manage team actions, and track stage progression.
            </Text>
            <Group>
              <Button
                component={Link}
                href={ROUTES.LOGIN}
                color="gold"
                c="navy.9"
                rightSection={<IconArrowRight size={16} />}
              >
                Continue to Sign In
              </Button>
              <Button component={Link} href={ROUTES.FAQ} variant="outline" color="gold">
                Read FAQ
              </Button>
            </Group>
          </Stack>
        </Card>
      </PageContainer>

      <Center py="var(--space-5)">
        <Stack align="center" gap="xs">
          <Divider w={96} color="navy.3" />
          <Text size="xs" c="dimmed">
            PIDEC 1.0 | University of Lagos Engineering Society
          </Text>
        </Stack>
      </Center>
    </PublicShell>
  );
}
