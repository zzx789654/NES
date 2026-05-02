import sqlite3
conn = sqlite3.connect('secvision.db')
c = conn.cursor()
print('tables:')
for row in c.execute("SELECT name,type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name"):
    print(row)
print('schema scans:')
for row in c.execute("SELECT sql FROM sqlite_master WHERE name='scans'"):
    print(row)
print('schema vulnerabilities:')
for row in c.execute("SELECT sql FROM sqlite_master WHERE name='vulnerabilities'"):
    print(row)
print('schema users:')
for row in c.execute("SELECT sql FROM sqlite_master WHERE name='users'"):
    print(row)
conn.close()
