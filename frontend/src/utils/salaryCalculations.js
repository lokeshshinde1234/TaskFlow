export const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) => Math.round(numberValue(value) * 100) / 100;

export const recalculateSalary = (input) => {
  const basic = numberValue(input.basic);
  const hra = numberValue(input.hra);
  const specialAllowance = numberValue(input.special_allowance);
  const travelAllowance = numberValue(input.travel_allowance);
  const medicalAllowance = numberValue(input.medical_allowance);
  const workingDays = Math.trunc(numberValue(input.working_days));
  const overtimeHours = numberValue(input.overtime_hours);
  const manualOvertimePay = numberValue(input.overtime_pay);
  const overtimePay = manualOvertimePay || (workingDays ? (basic / workingDays / 8) * overtimeHours : 0);
  const daysPresent = Math.trunc(numberValue(input.days_present));
  const paidLeavesUsed = Math.trunc(numberValue(input.paid_leaves_used));
  const daysAbsent = Math.trunc(numberValue(input.days_absent));
  const pfRate = numberValue(input.pf_rate ?? 12);
  const esiRate = numberValue(input.esi_rate ?? 0.75);
  const professionalTax = numberValue(input.professional_tax ?? 200);
  const tdsDeduction = numberValue(input.tds_deduction ?? input.tds_monthly);
  const loanDeduction = numberValue(input.loan_deduction);
  const otherDeductions = numberValue(input.other_deductions);

  const grossSalary = basic + hra + specialAllowance + travelAllowance + medicalAllowance + overtimePay;
  const perDayRate = workingDays ? grossSalary / workingDays : 0;
  const payableDays = daysPresent + paidLeavesUsed;
  const attendanceSalary = perDayRate * payableDays;
  const lopDays = Math.max(0, daysAbsent - paidLeavesUsed);
  const lopDeduction = perDayRate * lopDays;
  const pfDeduction = basic * (pfRate / 100);
  const esiDeduction = grossSalary * (esiRate / 100);
  const totalDeductions = pfDeduction + esiDeduction + professionalTax + tdsDeduction + loanDeduction + otherDeductions;
  const netSalary = Math.max(0, attendanceSalary - totalDeductions - lopDeduction);

  return {
    ...input,
    gross_salary: money(grossSalary),
    per_day_rate: money(perDayRate),
    payable_days: payableDays,
    attendance_salary: money(attendanceSalary),
    lop_days: lopDays,
    lop_deduction: money(lopDeduction),
    pf_deduction: money(pfDeduction),
    esi_deduction: money(esiDeduction),
    professional_tax: money(professionalTax),
    tds_deduction: money(tdsDeduction),
    loan_deduction: money(loanDeduction),
    other_deductions: money(otherDeductions),
    total_deductions: money(totalDeductions),
    net_salary: money(netSalary),
    overtime_hours: money(overtimeHours),
    overtime_pay: money(overtimePay),
  };
};

export const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
