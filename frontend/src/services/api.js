import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail || 'Session expired. Please login again.';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.setItem('auth_message', detail);
      window.dispatchEvent(new CustomEvent('taskflow:session-expired', {
        detail,
      }));
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  sendOTP: (payload) => api.post('/auth/send-otp', payload),
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  logoutOnClose: (token) => {
    if (!token) return false;

    const url = `${API_URL}/auth/logout-on-close`;
    if (navigator.sendBeacon) {
      const body = new Blob([token], { type: 'text/plain' });
      if (navigator.sendBeacon(url, body)) {
        return true;
      }
    }

    fetch(url, {
      method: 'POST',
      body: token,
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
    }).catch(() => null);
    return true;
  },
  presence: () => api.post('/auth/presence'),
  me: () => api.get('/auth/me'),
  companyRegister: (companyData) => api.post('/company/register', companyData),
  companyMe: () => api.get('/company/me'),
  employeeCompany: () => api.get('/company/employee'),
  updateCompanyLocation: (data) => api.put('/company/location', data),
  companyTiming: () => api.get('/company/timing'),
  updateCompanyTiming: (data) => api.put('/company/timing', data),
  uploadCompanyLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/company/logo-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const employeeAPI = {
  getCurrentEmployee: () => api.get('/employees/me'),
  getEmployee: (id) => api.get(`/employees/${id}`),
  getAllEmployees: (params = {}) => api.get('/employees', { params }),
  createEmployee: (data) => api.post('/employees', data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  deleteEmployee: (id) => api.delete(`/employees/${id}`),
};

export const attendanceAPI = {
  timeIn: (location) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem('offline_attendance_queue') || '[]');
      queue.push({ type: 'timeIn', payload: location || {}, createdAt: new Date().toISOString() });
      localStorage.setItem('offline_attendance_queue', JSON.stringify(queue));
      return Promise.resolve({ data: { offline: true, status: 'queued' } });
    }
    return api.post('/attendance/time-in', location || {});
  },
  timeOut: (attendanceId, location) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem('offline_attendance_queue') || '[]');
      queue.push({ type: 'timeOut', attendanceId, payload: location || {}, createdAt: new Date().toISOString() });
      localStorage.setItem('offline_attendance_queue', JSON.stringify(queue));
      return Promise.resolve({ data: { offline: true, status: 'queued' } });
    }
    return api.post(`/attendance/time-out/${attendanceId}`, location || {});
  },
  updateLateReason: (attendanceId, lateReason) => api.put(`/attendance/${attendanceId}/late-reason`, { late_reason: lateReason }),
  getAttendance: (employeeId) => api.get(`/attendance/employee/${employeeId}`),
};

export const syncOfflineAttendanceQueue = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, remaining: 0 };
  const queue = JSON.parse(localStorage.getItem('offline_attendance_queue') || '[]');
  const remaining = [];
  let synced = 0;
  for (const item of queue) {
    try {
      if (item.type === 'timeIn') {
        await api.post('/attendance/time-in', item.payload || {});
      } else if (item.type === 'timeOut' && item.attendanceId) {
        await api.post(`/attendance/time-out/${item.attendanceId}`, item.payload || {});
      }
      synced += 1;
    } catch (error) {
      remaining.push(item);
    }
  }
  localStorage.setItem('offline_attendance_queue', JSON.stringify(remaining));
  return { synced, remaining: remaining.length };
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineAttendanceQueue().catch(() => null);
  });
}

export const locationAPI = {
  trackLocation: (data) => api.post('/location/track', data),
  getEmployeeLocations: (employeeId, limit = 100) => api.get(`/location/employee/${employeeId}`, { params: { limit } }),
  getCompanyLocations: () => api.get('/location/company'),
};

export const salaryAPI = {
  createSalary: (data) => api.post('/salary', data),
  getEmployeeSalary: (employeeId) => api.get(`/salary/employee/${employeeId}`),
  updateSalary: (id, data) => api.put(`/salary/${id}`, data),
  getStructure: (employeeId) => api.get(`/v1/salary/structure/${employeeId}`),
  saveStructure: (data) => api.post('/v1/salary/structure', data),
  attendanceSummary: (employeeId, month) => api.get(`/v1/salary/attendance-summary/${employeeId}`, { params: { month } }),
  calculate: (data) => api.post('/v1/salary/calculate', data),
  saveRecord: (data) => api.post('/v1/salary/records', data),
  processRecord: (id) => api.patch(`/v1/salary/records/${id}/process`),
  approveRecord: (id) => api.patch(`/v1/salary/records/${id}/approve`),
  markPaid: (id) => api.patch(`/v1/salary/records/${id}/mark-paid`),
  listRecords: (params = {}) => api.get('/v1/salary/records', { params }),
  getRecord: (id) => api.get(`/v1/salary/records/${id}`),
  deleteRecord: (id) => api.delete(`/v1/salary/records/${id}`),
  generatePayslip: (id) => api.post(`/v1/salary/payslip/${id}/generate`),
  sendPayslip: (id, sent_via = 'email') => api.post(`/v1/salary/payslip/${id}/send`, { sent_via }),
  downloadPayslipUrl: (id) => `${API_URL}/v1/salary/payslip/${id}/download`,
  adminRecords: (params = {}) => api.get('/v1/admin/salary/records', { params }),
  adminAnalytics: () => api.get('/v1/admin/salary/analytics'),
  adminOverride: (id, reason) => api.patch(`/v1/admin/salary/records/${id}/override`, { reason }),
};

export const adminAPI = {
  analytics: () => api.get('/admin/analytics'),
};

export const platformAPI = {
  overview: () => api.get('/platform/overview'),
  listCompanies: () => api.get('/platform/companies'),
  listLocations: (limit = 100) => api.get('/platform/locations', { params: { limit } }),
  listAttendance: (limit = 500) => api.get('/platform/attendance', { params: { limit } }),
  getCompany: (companyId) => api.get(`/platform/companies/${companyId}`),
  updateCompany: (companyId, data) => api.put(`/platform/companies/${companyId}`, data),
  updateCompanyTiming: (companyId, data) => api.put(`/platform/companies/${companyId}/timing`, data),
  createEmployee: (companyId, data) => api.post(`/platform/companies/${companyId}/employees`, data),
  updateEmployee: (employeeId, data) => api.put(`/platform/employees/${employeeId}`, data),
  deleteEmployee: (employeeId) => api.delete(`/platform/employees/${employeeId}`),
};

export const publicAPI = {
  stats: () => api.get('/public/stats'),
};

export const enterpriseAPI = {
  auditLogs: () => api.get('/enterprise/audit-logs'),
  settings: () => api.get('/enterprise/settings'),
  saveSetting: (data) => api.put('/enterprise/settings', data),
  saveWhiteLabel: (data) => api.put('/enterprise/white-label', data),
  departments: () => api.get('/enterprise/departments'),
  createDepartment: (data) => api.post('/enterprise/departments', data),
  teams: () => api.get('/enterprise/teams'),
  createTeam: (data) => api.post('/enterprise/teams', data),
  shifts: () => api.get('/enterprise/shifts'),
  createShift: (data) => api.post('/enterprise/shifts', data),
  leaveTypes: () => api.get('/enterprise/leave-types'),
  createLeaveType: (data) => api.post('/enterprise/leave-types', data),
  leaveRequests: () => api.get('/enterprise/leave-requests'),
  createLeaveRequest: (data) => api.post('/enterprise/leave-requests', data),
  decideLeave: (id, status) => api.put(`/enterprise/leave-requests/${id}/decision`, { status }),
  leaveBalances: () => api.get('/enterprise/leave-balances'),
  salaryStructure: (data) => api.post('/enterprise/salary-structures', data),
  payrollRun: (data) => api.post('/enterprise/payroll-runs', data),
  payslips: () => api.get('/enterprise/payslips'),
  distributePayslip: (id) => api.post(`/enterprise/payslips/${id}/distribute`),
  projects: () => api.get('/enterprise/projects'),
  createProject: (data) => api.post('/enterprise/projects', data),
  createSprint: (data) => api.post('/enterprise/sprints', data),
  tasks: () => api.get('/enterprise/tasks'),
  createTask: (data) => api.post('/enterprise/tasks', data),
  updateTask: (id, data) => api.put(`/enterprise/tasks/${id}`, data),
  addTaskComment: (id, body) => api.post(`/enterprise/tasks/${id}/comments`, { body }),
  logTime: (data) => api.post('/enterprise/time-entries', data),
  punchVerification: (data) => api.post('/enterprise/punch-verifications', data),
  dailyAttendance: () => api.get('/enterprise/analytics/daily-attendance'),
  taskAnalytics: () => api.get('/enterprise/analytics/tasks'),
  payrollAnalytics: () => api.get('/enterprise/analytics/payroll'),
  createReport: (data) => api.post('/enterprise/reports', data),
  runReport: (type) => api.get(`/enterprise/reports/${type}`),
  billing: () => api.get('/enterprise/billing'),
  checkout: () => api.post('/enterprise/billing/checkout'),
  createApiKey: (data) => api.post('/enterprise/api-keys', data),
  createWebhook: (data) => api.post('/enterprise/webhooks', data),
  notifications: () => api.get('/enterprise/notifications'),
  runAnomalies: () => api.post('/enterprise/anomalies/run'),
  calculatePerformance: (period) => api.post('/enterprise/performance-scores/calculate', null, { params: { period } }),
  createReferral: (data) => api.post('/enterprise/referrals', data),
  mobileConfig: () => api.get('/enterprise/mobile/config'),
};

export default api;
