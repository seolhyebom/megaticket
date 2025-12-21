
import requests
import json
import sys

BASE_URL = "http://localhost:3000/api"

def hold_seat(seat_id="C-5", user_id="user-remote"):
    print(f"Holding seat {seat_id} for {user_id}...")
    payload = {
        "performanceId": "perf-1",
        "seats": [{"seatId": seat_id, "price": 150000, "grade": "VIP", "seatNumber": int(seat_id.split('-')[1]), "row": seat_id.split('-')[0]}], 
        "userId": user_id,
        "date": "2024-12-25",
        "time": "19:00"
    }
    
    try:
        res = requests.post(f"{BASE_URL}/holdings", json=payload)
        if res.status_code == 200:
            print(f"SUCCESS: Held {seat_id}. ID: {res.json()['holdingId']}")
            print(f"Expires at: {res.json()['expiresAt']}")
        else:
            print(f"FAILED: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    s_id = sys.argv[1] if len(sys.argv) > 1 else "C-5"
    hold_seat(s_id)
