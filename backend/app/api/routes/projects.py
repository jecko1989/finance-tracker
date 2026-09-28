from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.summary import ProjectSummary
from app.services import project_service, summary_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[ProjectRead]:
    return [
        ProjectRead(id=p.id, name=p.name, balance=balance, created_at=p.created_at)
        for p, balance in project_service.list_projects(db, current_user.id)
    ]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = project_service.create_project(db, current_user.id, payload.name)
    return ProjectRead(id=project.id, name=project.name, balance=Decimal("0"), created_at=project.created_at)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = project_service.get_project_or_404(db, current_user.id, project_id)
    balance = project_service.compute_balance(db, project.id)
    return ProjectRead(id=project.id, name=project.name, balance=balance, created_at=project.created_at)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = project_service.update_project(db, current_user.id, project_id, payload.name)
    balance = project_service.compute_balance(db, project.id)
    return ProjectRead(id=project.id, name=project.name, balance=balance, created_at=project.created_at)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    project_service.delete_project(db, current_user.id, project_id)


@router.get("/{project_id}/summary", response_model=ProjectSummary)
def get_project_summary(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectSummary:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return summary_service.get_project_summary(db, project_id)
