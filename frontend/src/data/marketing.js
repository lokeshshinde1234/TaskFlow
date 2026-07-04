import {
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiLock,
  FiMapPin,
  FiShield,
  FiUsers,
  FiZap,
} from 'react-icons/fi';

export const productModules = [
  {
    icon: FiUsers,
    title: 'Company and employee records',
    text: 'Centralized profiles, departments, positions, contact details, access status, and company ownership controls.',
    accent: 'cyan',
  },
  {
    icon: FiClock,
    title: 'Attendance operations',
    text: 'Time-in, time-out, late reasons, open sessions, daily history, and role-specific attendance visibility.',
    accent: 'emerald',
  },
  {
    icon: FiMapPin,
    title: 'Live location visibility',
    text: 'GPS tracking, company locations, employee movement history, and map-ready operational context.',
    accent: 'amber',
  },
  {
    icon: FiBriefcase,
    title: 'Salary and payroll',
    text: 'Salary structures, monthly records, deductions, bonuses, approvals, payslips, and payroll analytics.',
    accent: 'rose',
  },
  {
    icon: FiShield,
    title: 'Role-secured access',
    text: 'Founder Admin, Super Admin, and employee dashboards protected by JWT auth and scoped API access.',
    accent: 'indigo',
  },
  {
    icon: FiDatabase,
    title: 'Enterprise workflow data',
    text: 'Teams, shifts, projects, tasks, leave, reports, webhooks, API keys, and operational audit trails.',
    accent: 'slate',
  },
];

export const solutionPages = [
  {
    slug: '/companies',
    eyebrow: 'For companies',
    title: 'A polished operating desk for growing teams',
    text: 'Register a company, create a Founder Admin account, manage employees, track attendance, and keep payroll moving from one secure workspace.',
    icon: FiBriefcase,
  },
  {
    slug: '/clients',
    eyebrow: 'For clients',
    title: 'Clean visibility for service teams and field operations',
    text: 'Use real company, attendance, location, and payroll data to understand whether teams are active, verified, and ready for reporting.',
    icon: FiCheckCircle,
  },
  {
    slug: '/features',
    eyebrow: 'Platform',
    title: 'Everything connected to the same live backend',
    text: 'TaskFlow is built around the workflows that usually fragment across spreadsheets, chat, and manual reports.',
    icon: FiZap,
  },
  {
    slug: '/security',
    eyebrow: 'Security',
    title: 'Access, identity, and data controls built in',
    text: 'OTP verification, encrypted passwords, token sessions, scoped routes, and CORS configuration are ready for production hardening.',
    icon: FiLock,
  },
];

export const workflowSteps = [
  ['01', 'Register company', 'Create the company workspace and Founder Admin login.'],
  ['02', 'Add employees', 'Invite and manage employee profiles, timing, salary, and department data.'],
  ['03', 'Run daily operations', 'Track attendance, live location, active sessions, and late reasons.'],
  ['04', 'Close payroll', 'Review salary calculations, approvals, payslips, and reports.'],
];

export const trustPoints = [
  'SQLite locally, PostgreSQL-ready on Railway',
  'Redis-backed public stats cache when REDIS_URL is configured',
  'Production React build can be served by FastAPI',
  'Environment examples included for clean GitHub pushes',
];

export const pricingPlans = [
  {
    name: 'Starter',
    price: 'Deploy-ready',
    text: 'Best for small teams moving away from manual attendance sheets.',
    features: ['Company onboarding', 'Employee dashboard', 'Attendance history', 'Email OTP'],
  },
  {
    name: 'Operations',
    price: 'Scale-ready',
    text: 'For teams that need live location, payroll, and admin reporting.',
    features: ['Founder Admin console', 'Location tracking', 'Salary records', 'Analytics'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    text: 'For multi-workflow organizations with compliance and integration needs.',
    features: ['API keys', 'Webhooks', 'Audit logs', 'Advanced modules'],
  },
];
