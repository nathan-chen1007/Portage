"""GET /api/programs?country_code=JP&category=honey[&revenue=...&employees=...]"""

from fastapi import APIRouter, HTTPException, Query

from app.programs import service

router = APIRouter(tags=["programs"])


@router.get("/api/programs", response_model=service.ProgramsResponse)
def programs(country_code: str = Query(..., min_length=2, max_length=2), category: str | None = Query(None, max_length=40),
             revenue: service.Revenue = "unknown", employees: service.Employees = "unknown") -> service.ProgramsResponse:
    """Programs a founder may qualify for in this market. 'unknown' revenue/employees shows the rule, not a verdict."""
    if not country_code.isalpha():
        raise HTTPException(422, "country_code must be a 2-letter code")
    return service.programs_for(country_code, category, revenue, employees)
