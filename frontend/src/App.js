import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './context/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ContactPage from './pages/ContactPage';
import CompanyPage from './pages/CompanyPage';
import ClientsPage from './pages/ClientsPage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import SecurityPage from './pages/SecurityPage';
import Login from './pages/Login';
import CompanyOnboarding from './pages/CompanyOnboarding';
import SignupWithOTP from './pages/SignupWithOTP';
import EmployeeDashboard from './pages/EmployeeDashboard';
import FounderAdminDashboard from './pages/FounderAdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import CompanyDetailPage from './pages/CompanyDetailPage';
import EmployeeAttendanceReportPage from './pages/EmployeeAttendanceReportPage';
import EnterpriseAdminConsole from './pages/EnterpriseAdminConsole';
import SalaryPage from './pages/SalaryPage';
import SuperAdminSalaryPage from './pages/SuperAdminSalaryPage';
import SEOManager from './components/SEOManager';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <SEOManager />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/companies" element={<CompanyPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/company-onboarding" element={<CompanyOnboarding />} />
          <Route path="/signup" element={<SignupWithOTP />} />
          <Route
            path="/employee-dashboard"
            element={
              <ProtectedRoute roles={['employee']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-dashboard/attendance"
            element={
              <ProtectedRoute roles={['employee']}>
                <EmployeeAttendanceReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute roles={['founder_admin']}>
                <FounderAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard/employees/:employeeId/attendance"
            element={
              <ProtectedRoute roles={['founder_admin']}>
                <EmployeeAttendanceReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard/enterprise"
            element={
              <ProtectedRoute roles={['founder_admin']}>
                <EnterpriseAdminConsole />
              </ProtectedRoute>
            }
          />
          <Route
            path="/founder/salary"
            element={
              <ProtectedRoute roles={['founder_admin']}>
                <SalaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin-dashboard"
            element={
              <ProtectedRoute roles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin-dashboard/company/:companyId"
            element={
              <ProtectedRoute roles={['super_admin']}>
                <CompanyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/salary"
            element={
              <ProtectedRoute roles={['super_admin']}>
                <SuperAdminSalaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin-dashboard/company/:companyId/employees/:employeeId/attendance"
            element={
              <ProtectedRoute roles={['super_admin']}>
                <EmployeeAttendanceReportPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
