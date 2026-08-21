#!/usr/bin/env python3
"""
Verify Railway PostgreSQL Database Contents for Coach Clinic
"""
import subprocess
import json

def query_railway_db():
    print("=== STEP 3: Querying Live PostgreSQL Database on Railway ===")
    
    # Query Leads Table
    cmd_leads = [
        "/Users/yamijala/.railway/bin/railway", "run", "--service", "agilecoachclinicwebsite",
        "node", "-e",
        "const {Pool} = require('pg'); const p = new Pool({connectionString: process.env.DATABASE_URL}); p.query('SELECT id, timestamp, name, email, role, challenge FROM leads ORDER BY id DESC LIMIT 5').then(r => { console.log(JSON.stringify(r.rows, null, 2)); process.exit(0); });"
    ]
    
    # Query Visitor Logs Table
    cmd_visitors = [
        "/Users/yamijala/.railway/bin/railway", "run", "--service", "agilecoachclinicwebsite",
        "node", "-e",
        "const {Pool} = require('pg'); const p = new Pool({connectionString: process.env.DATABASE_URL}); p.query('SELECT id, timestamp, host, path, ip, referrer FROM visitor_logs ORDER BY id DESC LIMIT 5').then(r => { console.log(JSON.stringify(r.rows, null, 2)); process.exit(0); });"
    ]

    print("\n--- RECENT LEADS IN POSTGRESQL ---")
    try:
        res = subprocess.run(cmd_leads, capture_output=True, text=True)
        print(res.stdout if res.stdout else res.stderr)
    except Exception as e:
        print("Failed to query leads:", e)

    print("\n--- RECENT VISITOR LOGS IN POSTGRESQL ---")
    try:
        res = subprocess.run(cmd_visitors, capture_output=True, text=True)
        print(res.stdout if res.stdout else res.stderr)
    except Exception as e:
        print("Failed to query visitor logs:", e)

if __name__ == "__main__":
    query_railway_db()
