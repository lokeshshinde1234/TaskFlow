import sqlalchemy
from sqlalchemy import text
from app.database import engine

sql = open('migrations/manual_add_geofence.sql').read()
with engine.connect() as conn:
    for stmt in sql.split(';'):
        s = stmt.strip()
        if not s:
            continue
        try:
            conn.execute(text(s))
            print('Executed:', s)
        except Exception as e:
            print('Error executing:', s, e)
