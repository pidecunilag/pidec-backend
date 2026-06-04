'use client';

import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconFileText,
  IconInfoCircle,
  IconRefresh,
  IconScale,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/shared/ui';
import { platformClient } from '@/shared/lib/platform-client';

type CriterionKey =
  | 'problem_statement_clarity'
  | 'proposed_solution_quality'
  | 'theme_alignment'
  | 'feasibility_assessment'
  | 'departmental_relevance';

type StoredScore = {
  id: string;
  scores: Partial<Record<CriterionKey, number>>;
  comments: Partial<Record<CriterionKey | 'overall', string>>;
  total_score?: number | null;
  totalScore?: number | null;
  submitted_at?: string | null;
  submittedAt?: string | null;
};

type SubmissionFile = {
  id?: string;
  url?: string;
  filename?: string;
  sizeBytes?: number;
  size_bytes?: number;
};

type JudgeSubmission = {
  id: string;
  stage: 1 | 2 | 3;
  submitted_at?: string;
  submittedAt?: string;
  files?: SubmissionFile[];
  teams?: {
    id: string;
    name: string;
    department: string;
  };
  users?: {
    name: string;
    email: string;
  };
  judge_score?: StoredScore | null;
  judgeScore?: StoredScore | null;
};

const GUIDE_PDF_URL = '/stage-1-judging-guide.pdf';

const CRITERIA: Array<{
  key: CriterionKey;
  label: string;
  max: number;
  description: string;
}> = [
  {
    key: 'problem_statement_clarity',
    label: 'Problem Statement Clarity',
    max: 20,
    description:
      'How clearly the team defines the problem, who is affected, why it matters, and the consequence of leaving it unsolved.',
  },
  {
    key: 'proposed_solution_quality',
    label: 'Proposed Solution Quality',
    max: 30,
    description:
      'How strong, technically grounded, and appropriate the proposed engineering solution is.',
  },
  {
    key: 'theme_alignment',
    label: 'Theme Alignment',
    max: 20,
    description:
      'How clearly the proposal connects to Engineering for Impact: Building Inclusive Solutions for a Sustainable Future.',
  },
  {
    key: 'feasibility_assessment',
    label: 'Feasibility Assessment',
    max: 20,
    description:
      'How realistically the solution can be built, simulated, or implemented within stated constraints.',
  },
  {
    key: 'departmental_relevance',
    label: 'Departmental Relevance',
    max: 10,
    description:
      'How meaningfully the proposal applies engineering principles from the team department.',
  },
];

const DEPARTMENT_RELEVANCE = [
  ['Civil Engineering', 'Structural design, infrastructure, water systems, transportation, or construction engineering.'],
  ['Mechanical Engineering', 'Mechanical systems, thermodynamics, manufacturing, machine design, or mechatronics.'],
  ['Metallurgical & Materials Engineering', 'Material science, metallurgical processes, corrosion, composites, or material properties.'],
  ['Chemical Engineering', 'Chemical processes, reaction engineering, process design, fluid transport, or environmental engineering.'],
  ['Petroleum & Gas Engineering', 'Oil and gas exploration, production systems, pipeline engineering, reservoir management, or energy systems.'],
  ['Biomedical Engineering', 'Medical devices, healthcare systems, biosensors, clinical engineering, or biomedical instrumentation.'],
  ['Computer Engineering', 'Hardware systems, embedded systems, computer architecture, networking, or hardware-software integration.'],
  ['Electrical & Electronics Engineering', 'Power systems, circuit design, signal processing, control systems, or renewable energy technologies.'],
  ['Systems Engineering', 'Systems integration, process optimisation, modelling and simulation, or systems lifecycle management.'],
  ['Surveying & Geoinformatics', 'Geospatial data, land surveying, remote sensing, GIS systems, or geoinformation engineering.'],
];

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(date);
};

const getScore = (submission: JudgeSubmission) => submission.judge_score ?? submission.judgeScore ?? null;

export default function JudgeDashboard() {
  const [submissions, setSubmissions] = useState<JudgeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<JudgeSubmission | null>(null);
  const [scores, setScores] = useState<Partial<Record<CriterionKey, number>>>({});
  const [comments, setComments] = useState<Partial<Record<CriterionKey | 'overall', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const isMobile = useMediaQuery('(max-width: 48em)') ?? false;

  const totalScore = useMemo(
    () => CRITERIA.reduce((sum, criterion) => sum + (scores[criterion.key] ?? 0), 0),
    [scores],
  );

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformClient.listJudgeSubmissions(1);
      setSubmissions(data.submissions as unknown as JudgeSubmission[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, []);

  const openScoreModal = (submission: JudgeSubmission) => {
    const existing = getScore(submission);
    setSelected(submission);
    setScores(existing?.scores ?? {});
    setComments(existing?.comments ?? {});
  };

  const downloadProposal = async (submission: JudgeSubmission) => {
    const file = submission.files?.[0];
    const fileId = file?.id ?? file?.url;
    if (!fileId) {
      notifications.show({
        color: 'red',
        title: 'No file available',
        message: 'This submission does not have a proposal file attached.',
      });
      return;
    }

    try {
      const { download } = await platformClient.getJudgeSubmissionFileDownload(submission.id, fileId);
      window.open(download.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Download failed',
        message: err instanceof Error ? err.message : 'Could not open proposal file.',
      });
    }
  };

  const submitScore = async () => {
    if (!selected) return;

    const missing = CRITERIA.filter((criterion) => typeof scores[criterion.key] !== 'number');
    if (missing.length > 0) {
      notifications.show({
        color: 'red',
        title: 'Complete all scores',
        message: `Missing: ${missing.map((criterion) => criterion.label).join(', ')}`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        CRITERIA.map((criterion) => [criterion.key, scores[criterion.key] ?? 0]),
      ) as Record<CriterionKey, number>;
      const cleanedComments = Object.fromEntries(
        Object.entries(comments).filter(([, value]) => value && value.trim().length > 0),
      );
      const { score } = await platformClient.submitStage1Score(
        selected.id,
        payload,
        cleanedComments,
      );
      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === selected.id
            ? { ...submission, judge_score: score as unknown as StoredScore }
            : submission,
        ),
      );
      notifications.show({
        color: 'green',
        title: 'Score saved',
        message: 'The Stage 1 score has been sent to admin.',
      });
      setSelected(null);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Score not saved',
        message: err instanceof Error ? err.message : 'Could not save score.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer size="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Title order={2} c="navy.9">
              Judge Portal
            </Title>
            <Text c="dimmed">
              Review assigned Stage 1 proposals, enter rubric scores, and send them to admin.
            </Text>
          </Stack>
          <Group gap="sm" grow={isMobile}>
            <Button
              component="a"
              href={GUIDE_PDF_URL}
              download
              variant="light"
              leftSection={<IconDownload size={18} aria-hidden="true" />}
              w={isMobile ? '100%' : undefined}
            >
              Download guide
            </Button>
            <Button
              variant="outline"
              leftSection={<IconRefresh size={18} aria-hidden="true" />}
              onClick={() => void loadSubmissions()}
              loading={loading}
              w={isMobile ? '100%' : undefined}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        <Stage1GuideAccordion />

        {error ? (
          <Alert color="red" icon={<IconInfoCircle size={18} aria-hidden="true" />}>
            {error}
          </Alert>
        ) : null}

        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Stack gap={2}>
                <Title order={3}>Assigned submissions</Title>
                <Text size="sm" c="dimmed">
                  Scores are saved per submission and can be updated before admin finalises selection.
                </Text>
              </Stack>
              <Badge variant="light">{submissions.length} submissions</Badge>
            </Group>

            <Table.ScrollContainer minWidth={820}>
              <Table verticalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Team</Table.Th>
                    <Table.Th>Department</Table.Th>
                    <Table.Th>Submitted</Table.Th>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Score</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {submissions.map((submission) => {
                    const score = getScore(submission);
                    const file = submission.files?.[0];
                    const total = score?.total_score ?? score?.totalScore ?? null;

                    return (
                      <Table.Tr key={submission.id}>
                        <Table.Td>
                          <Text fw={700}>{submission.teams?.name ?? 'Unnamed team'}</Text>
                          <Text size="xs" c="dimmed">
                            {submission.users?.name ?? 'Team lead not available'}
                          </Text>
                        </Table.Td>
                        <Table.Td>{submission.teams?.department ?? 'Not available'}</Table.Td>
                        <Table.Td>{formatDate(submission.submitted_at ?? submission.submittedAt)}</Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconFileText size={16} aria-hidden="true" />}
                            onClick={() => void downloadProposal(submission)}
                            disabled={!file}
                          >
                            Open file
                          </Button>
                        </Table.Td>
                        <Table.Td>
                          {typeof total === 'number' ? (
                            <Text fw={700}>{total}/100</Text>
                          ) : (
                            <Text c="dimmed">Not scored</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={score ? 'green' : 'yellow'} variant="light">
                            {score ? 'Scored' : 'Pending'}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Button size="sm" onClick={() => openScoreModal(submission)}>
                            Score
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                  {loading ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text c="dimmed" ta="center" py="xl">
                          Loading assigned Stage 1 submissions...
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                  {!loading && submissions.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text c="dimmed" ta="center" py="xl">
                          No assigned Stage 1 submissions are available.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Card>
      </Stack>

      <Modal
        opened={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`Score ${selected?.teams?.name ?? 'submission'}`}
        size="xl"
        fullScreen={isMobile}
        centered={!isMobile}
        padding="lg"
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconScale size={18} aria-hidden="true" />}>
            Enter direct weighted scores. Comments are optional. Admin will use these scores to
            confirm representative teams.
          </Alert>

          {CRITERIA.map((criterion) => (
            <Paper key={criterion.key} withBorder radius="md" p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={2} maw={520}>
                    <Text fw={700}>{criterion.label}</Text>
                    <Text size="sm" c="dimmed">
                      {criterion.description}
                    </Text>
                  </Stack>
                  <NumberInput
                    label={`Score / ${criterion.max}`}
                    min={0}
                    max={criterion.max}
                    clampBehavior="strict"
                    value={scores[criterion.key] ?? ''}
                    onChange={(value) =>
                      setScores((current) => ({
                        ...current,
                        [criterion.key]: typeof value === 'number' ? value : undefined,
                      }))
                    }
                    w={isMobile ? '100%' : 140}
                  />
                </Group>
                <Textarea
                  label="Criterion comment"
                  placeholder="Optional"
                  autosize
                  minRows={2}
                  value={comments[criterion.key] ?? ''}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [criterion.key]: event.currentTarget.value,
                    }))
                  }
                />
              </Stack>
            </Paper>
          ))}

          <Textarea
            label="Overall comment"
            placeholder="Optional"
            autosize
            minRows={3}
            value={comments.overall ?? ''}
            onChange={(event) =>
              setComments((current) => ({ ...current, overall: event.currentTarget.value }))
            }
          />

          <Divider />
          <Group justify="space-between" align="center" wrap="wrap">
            <Text fw={800} size="lg">
              Total: {totalScore}/100
            </Text>
            <Group grow={isMobile} w={isMobile ? '100%' : undefined}>
              <Button
                variant="default"
                onClick={() => setSelected(null)}
                w={isMobile ? '100%' : undefined}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void submitScore()}
                loading={submitting}
                w={isMobile ? '100%' : undefined}
              >
                Save score
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </PageContainer>
  );
}

const Stage1GuideAccordion = () => (
  <Card withBorder radius="md" p="lg">
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={3}>Stage 1 Judging Guide</Title>
          <Text size="sm" c="dimmed">
            Use this guide while scoring. It is collapsible so the submissions stay easy to review.
          </Text>
        </Stack>
        <Button
          component="a"
          href={GUIDE_PDF_URL}
          download
          variant="light"
          leftSection={<IconDownload size={18} aria-hidden="true" />}
        >
          Download PDF
        </Button>
      </Group>

      <Accordion variant="separated" radius="md" defaultValue="purpose">
        <Accordion.Item value="purpose">
          <Accordion.Control>Purpose of Stage 1</Accordion.Control>
          <Accordion.Panel>
            <Text>
              Stage 1 is a selection stage. Each department will be represented in Stage 2 by one
              team. The goal is to identify the strongest proposal from each department based on
              clear thinking, sound engineering logic, and alignment with the PIDEC theme.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="responsibility">
          <Accordion.Control>Judge Responsibility</Accordion.Control>
          <Accordion.Panel>
            <Text>
              Your role is to independently review and score assigned Stage 1 submissions using
              the official rubric. Judges do not pick representative teams on the platform. Your
              scores and optional feedback go to admin, who will review results and confirm each
              department representative.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="rubric">
          <Accordion.Control>Stage 1 Scoring Rubric</Accordion.Control>
          <Accordion.Panel>
            <Table.ScrollContainer minWidth={620}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Criterion</Table.Th>
                    <Table.Th>Score Range</Table.Th>
                    <Table.Th>Weight</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {CRITERIA.map((criterion) => (
                    <Table.Tr key={criterion.key}>
                      <Table.Td>{criterion.label}</Table.Td>
                      <Table.Td>0-{criterion.max}</Table.Td>
                      <Table.Td>{criterion.max}%</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="criteria">
          <Accordion.Control>Criterion Guide</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              {CRITERIA.map((criterion) => (
                <Text key={criterion.key}>
                  <strong>{criterion.label}:</strong> {criterion.description}
                </Text>
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="department">
          <Accordion.Control>Departmental Relevance Reference</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              {DEPARTMENT_RELEVANCE.map(([department, description]) => (
                <Text key={department}>
                  <strong>{department}:</strong> {description}
                </Text>
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="conduct">
          <Accordion.Control>Confidentiality and Conduct</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Text>Review submissions independently and declare any conflict of interest.</Text>
              <Text>
                Keep scores, rankings, and deliberations confidential until official results are
                published.
              </Text>
              <Text>
                Do not discuss results with teams, departments, or external parties before the
                official announcement.
              </Text>
              <Text>
                Report any attempt by a team to lobby, influence, or improperly contact you.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  </Card>
);
