from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.transaction import Transaction


def compute_balance(db: Session, project_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.project_id == project_id)
        .scalar()
    )
    # ponytail: str() guards against SQLite returning a raw float for the
    # aggregate; Decimal(float) would introduce binary-float imprecision.
    return Decimal(str(total))


def get_project_or_404(db: Session, owner_id: int, project_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == owner_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progetto non trovato")
    return project


def list_projects(db: Session, owner_id: int) -> list[tuple[Project, Decimal]]:
    projects = (
        db.query(Project).filter(Project.owner_id == owner_id).order_by(Project.created_at).all()
    )
    return [(p, compute_balance(db, p.id)) for p in projects]


def create_project(db: Session, owner_id: int, name: str) -> Project:
    project = Project(owner_id=owner_id, name=name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, owner_id: int, project_id: int, name: str) -> Project:
    project = get_project_or_404(db, owner_id, project_id)
    project.name = name
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, owner_id: int, project_id: int) -> None:
    project = get_project_or_404(db, owner_id, project_id)
    db.delete(project)
    db.commit()
