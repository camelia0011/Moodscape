import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_db():
    try:
        # Connect to default postgres database
        conn = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            password='root',
            host='localhost',
            port='5432'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if database exists
        cur.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'moodtracker'")
        exists = cur.fetchone()
        
        if not exists:
            cur.execute('CREATE DATABASE moodtracker')
            print("✅ Database 'moodtracker' created successfully.")
        else:
            print("ℹ️ Database 'moodtracker' already exists.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error creating database: {e}")

if __name__ == "__main__":
    create_db()
