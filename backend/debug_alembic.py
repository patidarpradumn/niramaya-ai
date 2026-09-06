import os
import sys
sys.path.insert(0, os.path.abspath("."))
from alembic.config import Config
from alembic import command
from app.db.session import engine
from sqlalchemy import text
from app.db.base import Base

def run_test():
    alembic_cfg = Config("alembic.ini")
    
    print("Engine URL:", engine.url)
    
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        
    with engine.begin() as conn:
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
        print("Tables before upgrade:", tables)
        
    command.upgrade(alembic_cfg, "head")
    
    with engine.begin() as conn:
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
        print("Tables after upgrade:", tables)
        
    command.downgrade(alembic_cfg, "base")
    print("Downgrade successful")

if __name__ == "__main__":
    run_test()
