
import requests
import json
import time

BASE_URL = "http://localhost:3000/api"

def test_real_scenario():
    print("1. Creating holding for perf-1 (User A)...")
    payload = {
        "performanceId": "perf-1",
        "seats": [{"seatId": "B-10", "price": 150000, "grade": "VIP", "seatNumber": 10, "row": "B"}], 
        "userId": "user-A",
        "date": "2024-12-25",
        "time": "19:00"
    }
    
    # User A
    res1 = requests.post(f"{BASE_URL}/holdings", json=payload)
    print(f"[User A] Status: {res1.status_code}")
    print(f"[User A] Body: {res1.json()}")
    
    if res1.status_code != 200:
        print("Failed to create first holding")
        return

    holding_id = res1.json()['holdingId']

    # Check File Content via API
    print("\n2. Checking Seat Status for perf-1...")
    res_status = requests.get(f"{BASE_URL}/seats/perf-1")
    seats = res_status.json()['seats']
    print(f"Seat B-10 status: {seats.get('B-10', 'unknown')}")

    # User B (Same Seat)
    print("\n3. Creating holding for perf-1 (User B - Same Seat)...")
    payload['userId'] = "user-B"
    res2 = requests.post(f"{BASE_URL}/holdings", json=payload)
    print(f"[User B] Status: {res2.status_code}")
    print(f"[User B] Body: {res2.json()}")

    if res2.status_code == 409:
        print("SUCCESS: Conflict detected.")
    else:
        print("FAILURE: Conflict NOT detected!")

    # Cleanup
    print("\n4. Cleanup...")
    requests.delete(f"{BASE_URL}/holdings/{holding_id}")

if __name__ == "__main__":
    test_real_scenario()
