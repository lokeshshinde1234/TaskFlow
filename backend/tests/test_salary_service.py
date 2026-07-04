import unittest

from app.services.salary_service import calculate_salary, month_start, working_days_in_month


class SalaryCalculationTests(unittest.TestCase):
    def test_exact_salary_formula_chain(self):
        result = calculate_salary(
            {
                "basic": 30000,
                "hra": 12000,
                "special_allowance": 5000,
                "travel_allowance": 2000,
                "medical_allowance": 1000,
                "overtime_pay": 1000,
                "working_days": 25,
                "days_present": 20,
                "days_absent": 5,
                "paid_leaves_used": 2,
                "pf_rate": 12,
                "esi_rate": 0.75,
                "professional_tax": 200,
                "tds_deduction": 1000,
                "loan_deduction": 500,
                "other_deductions": 250,
            }
        )

        self.assertEqual(result["gross_salary"], 51000)
        self.assertEqual(result["per_day_rate"], 2040)
        self.assertEqual(result["payable_days"], 22)
        self.assertEqual(result["attendance_salary"], 44880)
        self.assertEqual(result["lop_days"], 3)
        self.assertEqual(result["lop_deduction"], 6120)
        self.assertEqual(result["pf_deduction"], 3600)
        self.assertEqual(result["esi_deduction"], 382.5)
        self.assertEqual(result["total_deductions"], 5932.5)
        self.assertEqual(result["net_salary"], 32827.5)

    def test_net_salary_never_goes_negative(self):
        result = calculate_salary(
            {
                "basic": 1000,
                "working_days": 20,
                "days_present": 1,
                "days_absent": 19,
                "paid_leaves_used": 0,
                "professional_tax": 5000,
            }
        )

        self.assertEqual(result["net_salary"], 0)

    def test_working_days_helper_uses_weekdays(self):
        self.assertEqual(working_days_in_month(month_start("2026-05")).__class__, int)
        self.assertGreater(working_days_in_month(month_start("2026-05")), 0)


if __name__ == "__main__":
    unittest.main()
