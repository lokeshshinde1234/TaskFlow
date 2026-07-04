export const FOUNDER_ADMIN_ROLE = 'founder_admin';
export const PLATFORM_SUPER_ADMIN_ROLE = 'super_admin';
export const PLATFORM_SUPER_ADMIN_EMAIL = 'superadmin@gmail.com';

export const isFounderAdminRole = (role) => role === FOUNDER_ADMIN_ROLE;

export const isPlatformSuperAdminRole = (role) => role === PLATFORM_SUPER_ADMIN_ROLE;

export const FOUNDER_ADMIN_DASHBOARD_PATH = '/admin-dashboard';
export const PLATFORM_SUPER_ADMIN_DASHBOARD_PATH = '/super-admin-dashboard';

export function isCompanyFounderUser(user) {
  if (!user) return false;
  if (user.company_id != null && user.company_id !== '') {
    if (isFounderAdminRole(user.role)) return true;
  }
  return false;
}

/** Only the dedicated platform super admin account (not company registrations). */
export function isPlatformSuperAdminUser(user, email) {
  const normalizedEmail = String(email || user?.email || '')
    .trim()
    .toLowerCase();
  if (normalizedEmail !== PLATFORM_SUPER_ADMIN_EMAIL) return false;
  if (!user || user.company_id != null) return false;
  return isPlatformSuperAdminRole(user.role);
}

export function getLoginRedirectPath(email, authPayload) {
  const user = authPayload?.user;
  if (isPlatformSuperAdminUser(user, email)) {
    return PLATFORM_SUPER_ADMIN_DASHBOARD_PATH;
  }
  if (isCompanyFounderUser(user)) {
    return FOUNDER_ADMIN_DASHBOARD_PATH;
  }
  return '/employee-dashboard';
}
