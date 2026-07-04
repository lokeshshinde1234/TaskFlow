import random
import string
from sqlalchemy.orm import Session
from app.models import Employee


def generate_unique_employee_id(db: Session, company_id: int, prefix: str = "EMP") -> str:
    """
    Generate a unique employee ID based on company ID and random suffix.
    Format: EMP{company_id}{random_suffix}
    Example: EMP001ABC123
    """
    max_attempts = 10
    for _ in range(max_attempts):
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        employee_id = f"{prefix}{str(company_id).zfill(3)}{suffix}"
        
        existing = db.query(Employee).filter(Employee.employee_id == employee_id).first()
        if not existing:
            return employee_id
    
    raise ValueError("Unable to generate unique employee ID after multiple attempts")
