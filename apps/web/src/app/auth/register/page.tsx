import type { Metadata } from 'next';
import StudentRegistrationForm from './form.js';

export const metadata: Metadata = {
  title: 'Student Registration | PIDEC',
  description: 'Create your PIDEC 1.0 competition account',
};

export default function RegisterPage() {
  return <StudentRegistrationForm />;
}
