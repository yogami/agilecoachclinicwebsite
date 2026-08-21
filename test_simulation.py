#!/usr/bin/env python3
"""
Coach Clinic End-to-End Substance Test & Visitor Simulation Script
Executes real HTTP traffic and test lead submissions against https://yamigopal.com
"""

import urllib.request
import urllib.parse
import json
import time

BASE_URL = "https://yamigopal.com"

# 1. Simulated Traffic (Various Devices, Referrers, and Paths)
traffic_scenarios = [
    {
        "name": "Visitor 1 (LinkedIn Lead on iPhone)",
        "path": "/",
        "referrer": "https://www.linkedin.com/in/yogami",
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
    },
    {
        "name": "Visitor 2 (Direct Traffic on Mac Chrome - Browsing Clinic)",
        "path": "/clinic",
        "referrer": "https://yamigopal.com",
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    {
        "name": "Visitor 3 (Google Organic Traffic - Drop Off)",
        "path": "/",
        "referrer": "https://www.google.com/search?q=agile+coach+mentorship",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
    }
]

# 2. Simulated Form Submissions (Leads prefixed with TEST_)
test_leads = [
    {
        "name": "TEST_Alex_ScrumMaster",
        "email": "test_alex_sm@agilefirm.com",
        "role": "Scrum Master",
        "challenge": "TEST LEAD: Dealing with top-down fake agile mandates and rigid sprint reporting."
    },
    {
        "name": "TEST_Sarah_AgileCoach",
        "email": "test_sarah_coach@techscaleup.io",
        "role": "Agile Coach",
        "challenge": "TEST LEAD: Hostile middle management blocking team autonomy and retrospective actions."
    },
    {
        "name": "TEST_David_DeliveryLead",
        "email": "test_david_lead@enterprisesoftware.de",
        "role": "Engineering Manager",
        "challenge": "TEST LEAD: Team burnout from async PR review queues and long cycle times."
    }
]

def run_traffic_simulation():
    print("=== STEP 1: Simulating Web Traffic & Page Visitors ===")
    for scenario in traffic_scenarios:
        req = urllib.request.Request(
            f"{BASE_URL}{scenario['path']}",
            headers={
                "User-Agent": scenario["user_agent"],
                "Referer": scenario["referrer"]
            }
        )
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"✓ {scenario['name']} -> HTTP {resp.status}")
        except Exception as e:
            print(f"X {scenario['name']} -> Failed: {e}")
        time.sleep(1)

def run_lead_submissions():
    print("\n=== STEP 2: Submitting Form Intakes (Prefixed with TEST_) ===")
    results = []
    for lead in test_leads:
        data = json.dumps(lead).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/api/triage",
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) WebBrowser/Test"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                print(f"✓ Submitted {lead['name']} ({lead['role']})")
                print(f"   -> Response: {body.get('message')}")
                print(f"   -> Generated Calendly Redirect: {body.get('redirectUrl')[:65]}...")
                results.append((lead, body))
        except Exception as e:
            print(f"X Failed {lead['name']}: {e}")
        time.sleep(1)
    return results

if __name__ == "__main__":
    run_traffic_simulation()
    run_lead_submissions()
    print("\n=== SIMULATION COMPLETE ===")
