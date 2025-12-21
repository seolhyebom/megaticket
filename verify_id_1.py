
import requests
import json
import time

BASE_URL = "http://localhost:3000/api"

def test_holding_reflection():
    print("1. [User A] Creating holding for performance ID '1'...")
    
    payload = {
        "performanceId": "1", 
        "seats": [{"seatId": "A-1", "price": 150000, "grade": "VIP", "seatNumber": 1, "row": "A"}], 
        "userId": "user-A",
        "date": "2024-12-25",
        "time": "19:00"
    }
    
    res1 = requests.post(f"{BASE_URL}/holdings", json=payload)
    print(f"[User A] Create Status: {res1.status_code}")
    print(f"[User A] Response: {res1.text}")
    
    if res1.status_code != 200:
        return

    holding_id = res1.json()['holdingId']
    print(f"Holding ID: {holding_id}")

    print("\n2. [User B] Checking Seat Status for performance ID '1'...")
    res_status = requests.get(f"{BASE_URL}/seats/1")
    print(f"[User B] Status Response Code: {res_status.status_code}")
    
    seats = res_status.json()['seats']
    # Debug: Print all keys in seats to see what we got
    print(f"Keys in status map: {list(seats.keys())[:5]}...") 
    
    status_a1 = seats.get('A-1', 'unknown')
    print(f"Seat A-1 status: {status_a1}")

    if status_a1 == 'holding':
        print("SUCCESS: Seat is correctly marked as 'holding' for ID '1'.")
    else:
        print(f"FAILURE: Seat is '{status_a1}' instead of 'holding'.")

    # Cleanup
    print("\n3. Cleanup...")
    requests.delete(f"{BASE_URL}/holdings/{holding_id}")

if __name__ == "__main__":
    test_holding_reflection()
