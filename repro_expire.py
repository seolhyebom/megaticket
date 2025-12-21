
import requests
import datetime
import dateutil.parser

BASE_URL = "http://localhost:3000/api"

def test_expire():
    print(f"Current System Time: {datetime.datetime.now(datetime.timezone.utc)}")
    
    payload = {
        "performanceId": "perf-1",
        "seats": [{"seatId": "C-5", "price": 150000, "grade": "VIP", "seatNumber": 5, "row": "C"}], 
        "userId": "debug-user-1",
        "date": "2024-12-25",
        "time": "19:00"
    }

    try:
        # Create
        res = requests.post(f"{BASE_URL}/holdings", json=payload)
        data = res.json()
        print(f"Response: {res.status_code}")
        print(f"Body: {data}")

        if 'expiresAt' in data:
            expires_at = dateutil.parser.parse(data['expiresAt'])
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            diff = (expires_at - now_utc).total_seconds()
            print(f"ExpiresAt: {expires_at}")
            print(f"Now (UTC): {now_utc}")
            print(f"Difference (Seconds): {diff}")
            
            # Allow some latency, but should be close to 60
            if 55 <= diff <= 65:
                print("Server TTL seems CORRECT (approx 60s).")
            else:
                print(f"Server TTL seems INCORRECT (Diff: {diff}s).")

            # Clean up
            if 'holdingId' in data:
                requests.delete(f"{BASE_URL}/holdings/{data['holdingId']}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_expire()
