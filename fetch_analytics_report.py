#!/usr/bin/env python3
"""
Fetch recent PostgreSQL visitor logs from Railway container output
"""
import subprocess

def fetch_logs():
    print("=== FETCHING RECENT RAILWAY VISITOR LOGS & POSTGRES ACTIVITY ===")
    cmd = ["/Users/yamijala/.railway/bin/railway", "logs", "--service", "agilecoachclinicwebsite"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        lines = res.stdout.splitlines()
        
        visitor_lines = [l for l in lines if "[DB LOG] Visitor inserted:" in l or "🚨 NEW LEAD CAPTURED:" in l]
        print(f"Total Log Events Found: {len(visitor_lines)}\n")
        
        for line in visitor_lines[-20:]:
            print(" •", line)
    except Exception as e:
        print("Error fetching logs:", e)

if __name__ == "__main__":
    fetch_logs()
