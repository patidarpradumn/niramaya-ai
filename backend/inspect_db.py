import sqlite3

conn = sqlite3.connect('mediguard.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables:", tables)

for t in tables:
    table_name = t[0]
    cursor.execute(f'SELECT count(*) FROM "{table_name}"')
    count = cursor.fetchone()[0]
    print(f'{table_name}: {count} rows')

print('\nUsers:')
try:
    cursor.execute('SELECT id, email, full_name, role, is_active, firebase_uid FROM users')
    for u in cursor.fetchall():
        print(u)
except Exception as e:
    print('Users query error:', e)
