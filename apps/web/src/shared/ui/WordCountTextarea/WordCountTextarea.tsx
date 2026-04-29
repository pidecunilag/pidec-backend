'use client';

import { Group, Progress, Stack, Text, Textarea, type TextareaProps } from '@mantine/core';
import { countWords } from '@pidec/shared';
import { forwardRef, type ChangeEvent } from 'react';

export interface WordCountTextareaProps extends Omit<TextareaProps, 'rightSection'> {
  /** Hard upper bound — server-enforced limit. */
  wordLimit: number;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Mantine Textarea wrapper that shows live word count + progress bar.
 *
 * Per PRD §6.2 word limits are enforced server-side; this component
 * surfaces the count for UX. Colour shifts to amber within 10% of the
 * limit and red once exceeded.
 */
export const WordCountTextarea = forwardRef<HTMLTextAreaElement, WordCountTextareaProps>(
  function WordCountTextarea({ wordLimit, value = '', onChange, error, ...rest }, ref) {
    const used = countWords(value);
    const ratio = used / wordLimit;
    const colour: 'navy.8' | 'gold.7' | 'red.7' =
      ratio > 1 ? 'red.7' : ratio > 0.9 ? 'gold.7' : 'navy.8';
    const progressColor = ratio > 1 ? 'red' : ratio > 0.9 ? 'gold' : 'navy';
    const remaining = wordLimit - used;

    return (
      <Stack gap={4}>
        <Textarea
          ref={ref}
          value={value}
          onChange={onChange}
          minRows={6}
          maxRows={20}
          autosize
          error={error}
          aria-describedby={`${rest.id ?? 'wordcount'}-helper`}
          {...rest}
        />
        <Group justify="space-between" gap="xs" id={`${rest.id ?? 'wordcount'}-helper`}>
          <Progress
            value={Math.min(100, ratio * 100)}
            color={progressColor}
            size="xs"
            radius="xl"
            style={{ flex: 1 }}
            aria-hidden="true"
          />
          <Text size="xs" c={colour} fw={500} aria-live="polite">
            {used} / {wordLimit} words
            {remaining < 0 ? ` (${Math.abs(remaining)} over)` : ''}
          </Text>
        </Group>
      </Stack>
    );
  },
);
