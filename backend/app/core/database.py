from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import Settings

engine = create_engine(Settings.DATABASE_URL)
SessionLocale = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocale()
    try:
        yield db
    finally:
        db.close()