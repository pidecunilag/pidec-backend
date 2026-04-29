'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Center,
  Container,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Progress,
  Badge,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { DEPARTMENTS } from '@pidec/shared';
import { authClient } from '../../../shared/lib/auth-client.js';

const LEVELS = [
  { value: '100', label: '100 Level' },
  { value: '200', label: '200 Level' },
  { value: '300', label: '300 Level' },
  { value: '400', label: '400 Level' },
  { value: '500', label: '500 Level' },
];

interface FormData {
  name: string;
  email: string;
  matricNumber: string;
  department: string;
  level: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  [key: string]: string | null;
}

/**
 * Student registration form with full validation.
 * Validates matric number format, password strength, and unique email.
 */
export default function StudentRegistrationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    matricNumber: '',
    department: '',
    level: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Validate password strength (0-100)
  const getPasswordStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let strength = 0;

    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 10;
    if (/[a-z]/.test(pwd)) strength += 10;
    if (/[0-9]/.test(pwd)) strength += 15;
    if (/[!@#$%^&*]/.test(pwd)) strength += 15;

    return Math.min(strength, 100);
  };

  const handlePasswordChange = (value: string) => {
    setFormData((prev) => ({ ...prev, password: value }));
    setPasswordStrength(getPasswordStrength(value));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (!/\s/.test(formData.name.trim())) {
      newErrors.name = 'Enter your full legal name (first and last)';
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Matric Number
    if (!formData.matricNumber.trim()) {
      newErrors.matricNumber = 'Matric number is required';
    } else {
      const cleanMatric = formData.matricNumber.replace(/\D/g, '');
      if (!/^\d{9}$/.test(cleanMatric)) {
        newErrors.matricNumber = 'Matric must be 9 digits';
      } else if (!/^(19|2[0-5])/.test(cleanMatric.substring(0, 2))) {
        newErrors.matricNumber = 'Invalid admission year (must be 19–25)';
      } else if (!cleanMatric.startsWith('04', 4)) {
        newErrors.matricNumber = 'Faculty code must be 04 (Engineering)';
      }
    }

    // Department
    if (!formData.department) {
      newErrors.department = 'Department is required';
    }

    // Level
    if (!formData.level) {
      newErrors.level = 'Level is required';
    }

    // Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Za-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authClient.register({
        email: formData.email.toLowerCase(),
        password: formData.password,
        name: formData.name.trim(),
        matricNumber: formData.matricNumber.replace(/\D/g, ''),
        department: formData.department,
        level: parseInt(formData.level, 10),
      });

      // Redirect to verification pending or dashboard
      router.push('/verify-email-pending');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh" py="xl" style={{ background: 'var(--navy-900)' }}>
      <Container size={500}>
        <Card p="xl">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {/* Header */}
              <Stack gap={2}>
                <Title order={2} c="navy.9">
                  Student Registration
                </Title>
                <Text c="dimmed" size="sm">
                  Complete your profile to join PIDEC 1.0
                </Text>
              </Stack>

              {/* Error Alert */}
              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Registration Failed"
                  color="red"
                  variant="light"
                >
                  {error}
                </Alert>
              )}

              {/* Full Name */}
              <TextInput
                label="Full Legal Name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.currentTarget.value }))}
                error={errors.name}
                disabled={loading}
                required
              />

              {/* Email */}
              <TextInput
                label="Email Address"
                placeholder="name@example.com"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.currentTarget.value }))}
                error={errors.email}
                disabled={loading}
                required
              />

              {/* Matric Number */}
              <TextInput
                label="Matric Number"
                placeholder="19 04 12345"
                description="Format: YY-FC-XXXXX (Year-Faculty-Serial). Engineering only (FC=04)"
                value={formData.matricNumber}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setFormData((prev) => ({ ...prev, matricNumber: val }));
                }}
                error={errors.matricNumber}
                disabled={loading}
                required
              />

              {/* Department */}
              <Select
                label="Department"
                placeholder="Select your department"
                data={DEPARTMENTS}
                value={formData.department}
                onChange={(val) => setFormData((prev) => ({ ...prev, department: val || '' }))}
                error={errors.department}
                disabled={loading}
                required
              />

              {/* Level */}
              <Select
                label="Academic Level"
                placeholder="Select your level"
                data={LEVELS}
                value={formData.level}
                onChange={(val) => setFormData((prev) => ({ ...prev, level: val || '' }))}
                error={errors.level}
                disabled={loading}
                required
              />

              {/* Password */}
              <Stack gap={6}>
                <PasswordInput
                  label="Password"
                  placeholder="Enter a strong password"
                  value={formData.password}
                  onChange={(e) => handlePasswordChange(e.currentTarget.value)}
                  error={errors.password}
                  disabled={loading}
                  required
                />
                {formData.password && (
                  <>
                    <Progress
                      value={passwordStrength}
                      size="sm"
                      color={
                        passwordStrength < 50 ? 'red' : passwordStrength < 80 ? 'yellow' : 'green'
                      }
                    />
                    <Text size="xs" c="dimmed">
                      Password Strength:{' '}
                      {passwordStrength < 50 ? 'Weak' : passwordStrength < 80 ? 'Good' : 'Strong'}
                    </Text>
                  </>
                )}
              </Stack>

              {/* Confirm Password */}
              <PasswordInput
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, confirmPassword: e.currentTarget.value }))
                }
                error={errors.confirmPassword}
                disabled={loading}
                required
              />

              {/* Password Requirements */}
              <Card bg="var(--navy-50)" p="sm" radius="md">
                <Stack gap={6}>
                  <Text size="xs" fw={600} c="navy.9">
                    Password Requirements:
                  </Text>
                  <Group gap={6} wrap="wrap">
                    <Badge
                      size="sm"
                      variant={formData.password.length >= 8 ? 'filled' : 'default'}
                      color={formData.password.length >= 8 ? 'green' : 'gray'}
                      leftSection={formData.password.length >= 8 ? <IconCheck size={12} /> : null}
                    >
                      8+ characters
                    </Badge>
                    <Badge
                      size="sm"
                      variant={/[A-Za-z]/.test(formData.password) ? 'filled' : 'default'}
                      color={/[A-Za-z]/.test(formData.password) ? 'green' : 'gray'}
                      leftSection={
                        /[A-Za-z]/.test(formData.password) ? <IconCheck size={12} /> : null
                      }
                    >
                      Letter
                    </Badge>
                    <Badge
                      size="sm"
                      variant={/[0-9]/.test(formData.password) ? 'filled' : 'default'}
                      color={/[0-9]/.test(formData.password) ? 'green' : 'gray'}
                      leftSection={/[0-9]/.test(formData.password) ? <IconCheck size={12} /> : null}
                    >
                      Number
                    </Badge>
                  </Group>
                </Stack>
              </Card>

              {/* Submit Button */}
              <Button type="submit" color="navy" loading={loading} disabled={loading} fullWidth>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              {/* Sign In Link */}
              <Text size="sm" c="dimmed" ta="center">
                Already have an account?{' '}
                <a href="/auth/login" style={{ color: 'var(--navy-600)', textDecoration: 'none' }}>
                  Sign in
                </a>
              </Text>
            </Stack>
          </form>
        </Card>
      </Container>
    </Center>
  );
}
