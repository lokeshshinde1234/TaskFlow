from calendar import monthrange
from datetime import date, datetime


MONEY_FIELDS = (
    "gross_salary",
    "per_day_rate",
    "attendance_salary",
    "pf_deduction",
    "esi_deduction",
    "total_deductions",
    "lop_deduction",
    "net_salary",
    "overtime_pay",
)


def month_start(value: str | date | datetime) -> datetime:
    if isinstance(value, datetime):
        return datetime(value.year, value.month, 1)
    if isinstance(value, date):
        return datetime(value.year, value.month, 1)
    parts = str(value).split("-")
    if len(parts) < 2:
        raise ValueError("Use YYYY-MM month format")
    return datetime(int(parts[0]), int(parts[1]), 1)


def working_days_in_month(month: datetime) -> int:
    _, days = monthrange(month.year, month.month)
    return sum(1 for day in range(1, days + 1) if date(month.year, month.month, day).weekday() < 5)


def calculate_salary(payload: dict) -> dict:
    basic = float(payload.get("basic") or 0)
    hra = float(payload.get("hra") or 0)
    special_allowance = float(payload.get("special_allowance") or 0)
    travel_allowance = float(payload.get("travel_allowance") or 0)
    medical_allowance = float(payload.get("medical_allowance") or 0)
    overtime_pay = float(payload.get("overtime_pay") or 0)
    working_days = int(payload.get("working_days") or 0)
    days_present = int(payload.get("days_present") or 0)
    paid_leaves_used = int(payload.get("paid_leaves_used") or 0)
    days_absent = int(payload.get("days_absent") or max(0, working_days - days_present))
    pf_rate = float(payload.get("pf_rate") if payload.get("pf_rate") is not None else 12)
    esi_rate = float(payload.get("esi_rate") if payload.get("esi_rate") is not None else 0.75)
    professional_tax = float(payload.get("professional_tax") if payload.get("professional_tax") is not None else 200)
    tds_deduction = float(payload.get("tds_deduction") if payload.get("tds_deduction") is not None else payload.get("tds_monthly") or 0)
    loan_deduction = float(payload.get("loan_deduction") or 0)
    other_deductions = float(payload.get("other_deductions") or 0)

    gross_salary = basic + hra + special_allowance + travel_allowance + medical_allowance + overtime_pay
    per_day_rate = gross_salary / working_days if working_days else 0
    payable_days = days_present + paid_leaves_used
    attendance_salary = per_day_rate * payable_days
    lop_days = max(0, days_absent - paid_leaves_used)
    lop_deduction = per_day_rate * lop_days
    pf_deduction = basic * (pf_rate / 100)
    esi_deduction = gross_salary * (esi_rate / 100)
    total_deductions = pf_deduction + esi_deduction + professional_tax + tds_deduction + loan_deduction + other_deductions
    net_salary = max(0, attendance_salary - total_deductions - lop_deduction)

    result = {
        **payload,
        "working_days": working_days,
        "days_present": days_present,
        "days_absent": days_absent,
        "paid_leaves_used": paid_leaves_used,
        "payable_days": payable_days,
        "lop_days": lop_days,
        "gross_salary": gross_salary,
        "per_day_rate": per_day_rate,
        "attendance_salary": attendance_salary,
        "pf_deduction": pf_deduction,
        "esi_deduction": esi_deduction,
        "professional_tax": professional_tax,
        "tds_deduction": tds_deduction,
        "loan_deduction": loan_deduction,
        "other_deductions": other_deductions,
        "total_deductions": total_deductions,
        "lop_deduction": lop_deduction,
        "net_salary": net_salary,
        "overtime_pay": overtime_pay,
    }
    for field in MONEY_FIELDS:
        result[field] = round(float(result.get(field) or 0), 2)
    return result
