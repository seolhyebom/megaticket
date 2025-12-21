
import requests
import json
import time

BASE_URL = "http://localhost:3000/api"

def test_holding_conflict():
    print("1. Creating first holding...")
    payload = {
        "performanceId": "perf-test-1",
        "seats": [{"seatId": "A-1", "price": 100}],
        "userId": "user-1",
        "date": "2024-12-25",
        "time": "19:00"
    }
    
    try:
        res1 = requests.post(f"{BASE_URL}/holdings", json=payload)
        print(f"User 1 Response: {res1.status_code}")
        print(res1.json())
        
        if res1.status_code != 200:
            print("Failed to create first holding")
            return

        holding_id = res1.json()['holdingId']
        print(f"Holding created: {holding_id}")

        print("\n2. Creating second holding (same seat)...")
        payload2 = payload.copy()
        payload2['userId'] = "user-2"
        
        res2 = requests.post(f"{BASE_URL}/holdings", json=payload2)
        print(f"User 2 Response: {res2.status_code}")
        print(res2.json())

        if res2.status_code == 409:
            print("SUCCESS: Conflict detected correctly.")
        else:
            print("FAILURE: Conflict NOT detected.")

        print("\n3. Checking Seat Status (GET)...")
        res3 = requests.get(f"{BASE_URL}/seats/perf-test-1")
        print(f"GET Status Response: {res3.status_code}")
        seats = res3.json()['seats']
        print(f"Seat A-1 status: {seats.get('A-1', 'unknown')}")
        
        if seats.get('A-1') == 'holding':
            print("SUCCESS: Seat status is 'holding'.")
        else:
            print(f"FAILURE: Seat status is '{seats.get('A-1')}'.")

        print("\n4. Cleaning up...")
        requests.delete(f"{BASE_URL}/holdings/{holding_id}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_holding_conflict()
