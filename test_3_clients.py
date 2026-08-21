#!/usr/bin/env python3
"""
Simulate 3 realistic potential clients submitting triage requests on yamigopal.com
"""

import urllib.request
import urllib.parse
import json
import time

BASE_URL = "https://yamigopal.com"

potential_clients = [
    {
        "name": "TEST_Marcus_Weber",
        "email": "marcus.weber@auto-tech.de",
        "role": "Scrum Master",
        "challenge": "Middle management is forcing rigid waterfall deadlines into 2-week sprints while demanding daily micromanagement status reports."
    },
    {
        "name": "TEST_Elena_Rostova",
        "email": "elena.r@fintech-pay.co.uk",
        "role": "Agile Coach",
        "challenge": "Executive team insists on SAFe compliance slides, but development teams suffer from 3-week async PR review queues and zero flow efficiency."
    },
    {
        "name": "TEST_Tobias_Lindqvist",
        "email": "tobias.l@medtech-health.se",
        "role": "Engineering Manager",
        "challenge": "Navigating strict EU regulatory compliance while trying to introduce TDD and pair programming to prevent developer burnout."
    }
]

def run_client_simulations():
    print("=== SIMULATING 3 POTENTIAL CLIENT INTAKES ===")
    
    for idx, client in enumerate(potential_clients, 1):
        print(f"\n--- Potential Client {idx}: {client['name']} ({client['role']}) ---")
        print(f"Company Email: {client['email']}")
        print(f"Workplace Challenge: {client['challenge']}")
        
        # 1. Post Lead to /api/triage
        data = json.dumps(client).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/api/triage",
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) WebBrowser/ClientSim"
            },
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req) as resp:
                res_body = json.loads(resp.read().decode("utf-8"))
                proxy_token_url = res_body.get("redirectUrl")
                print(f"✓ Form Intake Captured via API: {res_body.get('message')}")
                print(f"   -> Returned Ephemeral Proxy Token URL: {proxy_token_url}")
                
                # 2. Test Proxy Gateway Redirect
                proxy_full_url = f"{BASE_URL}{proxy_token_url}"
                proxy_req = urllib.request.Request(
                    proxy_full_url,
                    headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
                )
                
                # Prevent auto-following to inspect HTTP 302 location header
                class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
                    def redirect_request(self, req, fp, code, msg, headers, newurl):
                        return None

                opener = urllib.request.build_opener(NoRedirectHandler)
                try:
                    proxy_resp = opener.open(proxy_req)
                    location = proxy_resp.headers.get("Location")
                    print(f"   -> HTTP 302 Gateway Redirect Location: {location[:80]}...")
                except urllib.error.HTTPError as he:
                    if he.code == 302:
                        location = he.headers.get("Location")
                        print(f"   -> HTTP 302 Gateway Redirect Location: {location[:85]}...")
                    else:
                        print(f"   -> Gateway Error: {he}")

        except Exception as e:
            print(f"X Failed Client {idx}: {e}")
        
        time.sleep(2)

if __name__ == "__main__":
    run_client_simulations()
    print("\n=== CLIENT SIMULATION COMPLETED ===")
