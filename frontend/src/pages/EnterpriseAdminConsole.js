import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiBell, FiBriefcase, FiCalendar, FiCreditCard, FiGitBranch, FiKey, FiLayers, FiMapPin, FiSave, FiShield, FiUsers } from 'react-icons/fi';
import { employeeAPI, enterpriseAPI } from '../services/api';

const tabs = [
  ['org', 'Org', FiUsers],
  ['attendance', 'Attendance', FiMapPin],
  ['leave', 'Leave', FiCalendar],
  ['payroll', 'Payroll', FiCreditCard],
  ['projects', 'Projects', FiGitBranch],
  ['platform', 'Platform', FiShield],
];

const todayInput = () => new Date().toISOString().slice(0, 16);

export default function EnterpriseAdminConsole() {
  const [tab, setTab] = useState('org');
  const [employees, setEmployees] = useState([]);
  const [state, setState] = useState({
    departments: [],
    teams: [],
    shifts: [],
    leaveTypes: [],
    leaveRequests: [],
    payslips: [],
    projects: [],
    tasks: [],
    auditLogs: [],
    notifications: [],
    dailyAttendance: null,
    taskAnalytics: null,
    payrollAnalytics: null,
    billing: null,
  });
  const [forms, setForms] = useState({
    department: { name: '', description: '' },
    team: { name: '', department_id: '' },
    shift: { name: '', employee_id: '', start_at: todayInput(), end_at: todayInput() },
    leaveType: { name: 'Paid Leave', annual_allowance: 18, accrual_per_month: 1.5 },
    payroll: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    project: { name: '', description: '' },
    task: { title: '', project_id: '', assignee_employee_id: '', status: 'todo', priority: 'medium' },
    setting: { key: 'attendance.remote_enabled', value: 'true' },
    whiteLabel: { logo_url: '', primary_color: '#0891b2', custom_domain: '', email_sender: '' },
    apiKey: { name: 'Default integration', scopes: 'employees:read,attendance:read' },
    webhook: { url: '', events: 'clock-in,leave.approved,payslip.generated' },
  });
  const [message, setMessage] = useState('');

  const employeeOptions = useMemo(() => employees.map((employee) => (
    <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>
  )), [employees]);

  const load = async () => {
    const [
      employeeResponse,
      departments,
      teams,
      shifts,
      leaveTypes,
      leaveRequests,
      payslips,
      projects,
      tasksResponse,
      auditLogs,
      notifications,
      dailyAttendance,
      taskAnalytics,
      payrollAnalytics,
      billing,
    ] = await Promise.all([
      employeeAPI.getAllEmployees().catch(() => ({ data: [] })),
      enterpriseAPI.departments().catch(() => ({ data: [] })),
      enterpriseAPI.teams().catch(() => ({ data: [] })),
      enterpriseAPI.shifts().catch(() => ({ data: [] })),
      enterpriseAPI.leaveTypes().catch(() => ({ data: [] })),
      enterpriseAPI.leaveRequests().catch(() => ({ data: [] })),
      enterpriseAPI.payslips().catch(() => ({ data: [] })),
      enterpriseAPI.projects().catch(() => ({ data: [] })),
      enterpriseAPI.tasks().catch(() => ({ data: [] })),
      enterpriseAPI.auditLogs().catch(() => ({ data: [] })),
      enterpriseAPI.notifications().catch(() => ({ data: [] })),
      enterpriseAPI.dailyAttendance().catch(() => ({ data: null })),
      enterpriseAPI.taskAnalytics().catch(() => ({ data: null })),
      enterpriseAPI.payrollAnalytics().catch(() => ({ data: null })),
      enterpriseAPI.billing().catch(() => ({ data: null })),
    ]);
    setEmployees(employeeResponse.data);
    setState({
      departments: departments.data,
      teams: teams.data,
      shifts: shifts.data,
      leaveTypes: leaveTypes.data,
      leaveRequests: leaveRequests.data,
      payslips: payslips.data,
      projects: projects.data,
      tasks: tasksResponse.data,
      auditLogs: auditLogs.data,
      notifications: notifications.data,
      dailyAttendance: dailyAttendance.data,
      taskAnalytics: taskAnalytics.data,
      payrollAnalytics: payrollAnalytics.data,
      billing: billing.data,
    });
  };

  useEffect(() => {
    load().catch(() => setMessage('Some enterprise modules could not be loaded for this role.'));
  }, []);

  const updateForm = (name, patch) => setForms((current) => ({ ...current, [name]: { ...current[name], ...patch } }));

  const run = async (action, success) => {
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Action failed.');
    }
  };

  const Panel = ({ title, icon: Icon, children }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="text-cyan-600 dark:text-cyan-300" />
        <h2 className="font-black text-slate-950 dark:text-white">{title}</h2>
      </div>
      {children}
    </section>
  );

  const TextInput = ({ value, onChange, placeholder, type = 'text' }) => (
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Enterprise modules</p>
            <h1 className="text-2xl font-black">TaskFlow Admin Console</h1>
          </div>
          <button onClick={() => run(() => enterpriseAPI.runAnomalies(), 'Anomaly scan completed.')} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
            <FiActivity /> Run anomaly scan
          </button>
        </header>

        {message && <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">{message}</div>}

        <nav className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-6">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold ${tab === id ? 'border-cyan-500 bg-cyan-500 text-slate-950' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
              <Icon /> {label}
            </button>
          ))}
        </nav>

        {tab === 'org' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Departments" icon={FiUsers}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <TextInput value={forms.department.name} onChange={(value) => updateForm('department', { name: value })} placeholder="Department name" />
                <TextInput value={forms.department.description} onChange={(value) => updateForm('department', { description: value })} placeholder="Description" />
                <button onClick={() => run(() => enterpriseAPI.createDepartment(forms.department), 'Department created.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white"><FiSave /></button>
              </div>
              <div className="mt-4 grid gap-2">{state.departments.map((row) => <div key={row.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">{row.name}</div>)}</div>
            </Panel>
            <Panel title="Teams" icon={FiLayers}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <TextInput value={forms.team.name} onChange={(value) => updateForm('team', { name: value })} placeholder="Team name" />
                <select value={forms.team.department_id} onChange={(event) => updateForm('team', { department_id: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <option value="">Department</option>
                  {state.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <button onClick={() => run(() => enterpriseAPI.createTeam({ ...forms.team, department_id: forms.team.department_id ? Number(forms.team.department_id) : undefined }), 'Team created.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white"><FiSave /></button>
              </div>
              <div className="mt-4 grid gap-2">{state.teams.map((row) => <div key={row.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">{row.name}</div>)}</div>
            </Panel>
          </div>
        )}

        {tab === 'attendance' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Shift Scheduling" icon={FiCalendar}>
              <div className="grid gap-2">
                <TextInput value={forms.shift.name} onChange={(value) => updateForm('shift', { name: value })} placeholder="Shift name" />
                <select value={forms.shift.employee_id} onChange={(event) => updateForm('shift', { employee_id: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Employee</option>{employeeOptions}</select>
                <TextInput type="datetime-local" value={forms.shift.start_at} onChange={(value) => updateForm('shift', { start_at: value })} />
                <TextInput type="datetime-local" value={forms.shift.end_at} onChange={(value) => updateForm('shift', { end_at: value })} />
                <button onClick={() => run(() => enterpriseAPI.createShift({ ...forms.shift, employee_id: forms.shift.employee_id ? Number(forms.shift.employee_id) : undefined }), 'Shift scheduled.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white">Create shift</button>
              </div>
            </Panel>
            <Panel title="Daily Summary" icon={FiActivity}>
              <p className="text-4xl font-black">{state.dailyAttendance?.present || 0}/{state.dailyAttendance?.total_employees || 0}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Present today. Late: {state.dailyAttendance?.late || 0}. Absent: {state.dailyAttendance?.absent || 0}.</p>
              <div className="mt-4 grid gap-2">{state.shifts.slice(0, 5).map((shift) => <div key={shift.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">{shift.name} / {new Date(shift.start_at).toLocaleString()}</div>)}</div>
            </Panel>
          </div>
        )}

        {tab === 'leave' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Leave Policy" icon={FiCalendar}>
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
                <TextInput value={forms.leaveType.name} onChange={(value) => updateForm('leaveType', { name: value })} placeholder="Leave type" />
                <TextInput type="number" value={forms.leaveType.annual_allowance} onChange={(value) => updateForm('leaveType', { annual_allowance: Number(value) })} />
                <TextInput type="number" value={forms.leaveType.accrual_per_month} onChange={(value) => updateForm('leaveType', { accrual_per_month: Number(value) })} />
                <button onClick={() => run(() => enterpriseAPI.createLeaveType(forms.leaveType), 'Leave type saved.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white"><FiSave /></button>
              </div>
            </Panel>
            <Panel title="Approvals" icon={FiBell}>
              <div className="grid gap-2">{state.leaveRequests.map((row) => <div key={row.id} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800"><span>Employee #{row.employee_id} / {row.days} days / {row.status}</span>{row.status === 'pending' && <button onClick={() => run(() => enterpriseAPI.decideLeave(row.id, 'approved'), 'Leave approved.')} className="rounded-md bg-emerald-600 px-3 py-1 font-bold text-white">Approve</button>}</div>)}</div>
            </Panel>
          </div>
        )}

        {tab === 'payroll' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Payroll Run" icon={FiCreditCard}>
              <div className="grid gap-2 sm:grid-cols-[120px_120px_auto]">
                <TextInput type="number" value={forms.payroll.month} onChange={(value) => updateForm('payroll', { month: Number(value) })} />
                <TextInput type="number" value={forms.payroll.year} onChange={(value) => updateForm('payroll', { year: Number(value) })} />
                <button onClick={() => run(() => enterpriseAPI.payrollRun(forms.payroll), 'Payroll calculated and payslips generated.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white">Run</button>
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Total net pay: {state.payrollAnalytics?.total_net_pay || 0}</p>
            </Panel>
            <Panel title="Payslips" icon={FiBriefcase}>
              <div className="grid gap-2">{state.payslips.slice(0, 8).map((row) => <div key={row.id} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800"><span>Employee #{row.employee_id} / {row.month}/{row.year} / {row.net_pay}</span><button onClick={() => run(() => enterpriseAPI.distributePayslip(row.id), 'Payslip distributed.')} className="rounded-md bg-slate-950 px-3 py-1 font-bold text-white dark:bg-white dark:text-slate-950">Send</button></div>)}</div>
            </Panel>
          </div>
        )}

        {tab === 'projects' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Projects" icon={FiGitBranch}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <TextInput value={forms.project.name} onChange={(value) => updateForm('project', { name: value })} placeholder="Project name" />
                <TextInput value={forms.project.description} onChange={(value) => updateForm('project', { description: value })} placeholder="Description" />
                <button onClick={() => run(() => enterpriseAPI.createProject(forms.project), 'Project created.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white"><FiSave /></button>
              </div>
              <div className="mt-4 grid gap-2">{state.projects.map((row) => <div key={row.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">{row.name}</div>)}</div>
            </Panel>
            <Panel title="Kanban Tasks" icon={FiLayers}>
              <div className="grid gap-2">
                <TextInput value={forms.task.title} onChange={(value) => updateForm('task', { title: value })} placeholder="Task title" />
                <select value={forms.task.project_id} onChange={(event) => updateForm('task', { project_id: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Project</option>{state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                <select value={forms.task.assignee_employee_id} onChange={(event) => updateForm('task', { assignee_employee_id: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Assignee</option>{employeeOptions}</select>
                <button onClick={() => run(() => enterpriseAPI.createTask({ ...forms.task, project_id: forms.task.project_id ? Number(forms.task.project_id) : undefined, assignee_employee_id: forms.task.assignee_employee_id ? Number(forms.task.assignee_employee_id) : undefined }), 'Task created.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white">Create task</button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">{['todo', 'in_progress', 'done'].map((status) => <div key={status} className="rounded-md bg-slate-100 p-2 dark:bg-slate-800"><p className="mb-2 text-xs font-bold uppercase">{status.replace('_', ' ')}</p>{state.tasks.filter((task) => task.status === status).map((task) => <div key={task.id} className="mb-2 rounded bg-white p-2 text-sm dark:bg-slate-900">{task.title}</div>)}</div>)}</div>
            </Panel>
          </div>
        )}

        {tab === 'platform' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Settings & White Label" icon={FiShield}>
              <div className="grid gap-2">
                <TextInput value={forms.setting.key} onChange={(value) => updateForm('setting', { key: value })} placeholder="Setting key" />
                <TextInput value={forms.setting.value} onChange={(value) => updateForm('setting', { value })} placeholder="Setting value" />
                <button onClick={() => run(() => enterpriseAPI.saveSetting(forms.setting), 'Setting saved.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white">Save setting</button>
                <TextInput value={forms.whiteLabel.primary_color} onChange={(value) => updateForm('whiteLabel', { primary_color: value })} placeholder="Primary color" />
                <TextInput value={forms.whiteLabel.custom_domain} onChange={(value) => updateForm('whiteLabel', { custom_domain: value })} placeholder="Custom domain" />
                <button onClick={() => run(() => enterpriseAPI.saveWhiteLabel(forms.whiteLabel), 'White-label settings saved.')} className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white dark:bg-white dark:text-slate-950">Save branding</button>
              </div>
            </Panel>
            <Panel title="Integrations" icon={FiKey}>
              <div className="grid gap-2">
                <TextInput value={forms.apiKey.name} onChange={(value) => updateForm('apiKey', { name: value })} placeholder="API key name" />
                <button onClick={() => run(() => enterpriseAPI.createApiKey({ name: forms.apiKey.name, scopes: forms.apiKey.scopes.split(',').map((scope) => scope.trim()).filter(Boolean) }), 'API key created. Copy it from the API response in network tools.')} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white">Create API key</button>
                <TextInput value={forms.webhook.url} onChange={(value) => updateForm('webhook', { url: value })} placeholder="Webhook URL" />
                <button onClick={() => run(() => enterpriseAPI.createWebhook({ url: forms.webhook.url, events: forms.webhook.events.split(',').map((event) => event.trim()).filter(Boolean) }), 'Webhook endpoint registered.')} className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white dark:bg-white dark:text-slate-950">Create webhook</button>
                <button onClick={() => run(() => enterpriseAPI.checkout(), 'Billing checkout opened on the backend response.')} className="rounded-md border border-slate-300 px-4 py-2 font-bold">Meter seats & checkout</button>
              </div>
            </Panel>
            <Panel title="Audit Log" icon={FiActivity}>
              <div className="max-h-80 overflow-auto">{state.auditLogs.slice(0, 20).map((row) => <div key={row.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">{row.action} / {row.entity_type} / {new Date(row.created_at).toLocaleString()}</div>)}</div>
            </Panel>
            <Panel title="Notifications" icon={FiBell}>
              <div className="grid gap-2">{state.notifications.slice(0, 8).map((row) => <div key={row.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">{row.title}</div>)}</div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
