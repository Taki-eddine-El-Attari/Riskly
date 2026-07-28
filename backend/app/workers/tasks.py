from app.core.database import get_worker_session
from app.repositories.analysis_repo import AnalysisRepository

@celery_app.task
def analyze_domain_task(analysis_id: str):
    with get_worker_session() as db:
        repo = AnalysisRepository(db)
        analysis = repo.get_by_id(analysis_id)

        analysis.status = "in_progress"
        db.commit()                      

        analysis.status = "done"
        analysis.verdict = verdict
        db.commit()                      