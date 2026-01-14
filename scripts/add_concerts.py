import boto3
import json

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')
table = dynamodb.Table('plcr-gtbl-performances')

concerts = [
    {
        "performanceId": "perf-bts-worldtour",
        "title": "방탄소년단 월드 투어",
        "venueId": "charlotte-theater",
        "venue": "잠실 종합운동장 주경기장",
        "posterUrl": "/posters/bts.jpg",
        "dates": ["2026-02-20", "2026-02-21", "2026-02-22"],
        "times": ["19:00"],
        "dateRange": "2026.02.20 - 2026.02.22",
        "description": "BTS MAP OF THE SOUL TOUR - 전 세계를 감동시킨 무대가 서울에서 펼쳐집니다",
        "duration": "180분",
        "runtime": "약 3시간",
        "ageRating": "전체 관람가",
        "price": "VIP석 220,000원",
        "cast": {"bts": ["정국", "뷔", "지민", "RM", "제이홉", "슈가", "진"]},
        "grades": [
            {"grade": "VIP", "price": 220000, "color": "#FFD700"},
            {"grade": "R", "price": 170000, "color": "#C0C0C0"}
        ],
        "createdAt": "2026-01-14"
    },
    {
        "performanceId": "perf-blackpink-worldtour",
        "title": "블랙핑크 월드 투어",
        "venueId": "charlotte-theater",
        "venue": "고양 종합운동장",
        "posterUrl": "/posters/blackpink.jpg",
        "dates": ["2026-03-13", "2026-03-14", "2026-03-15"],
        "times": ["19:00"],
        "dateRange": "2026.03.13 - 2026.03.15",
        "description": "BLACKPINK DEADLINE WORLD TOUR IN GOYANG - 블랙핑크 컴백 월드 투어",
        "duration": "170분",
        "runtime": "약 2시간 50분",
        "ageRating": "전체 관람가",
        "price": "VIP석 210,000원",
        "cast": {"blackpink": ["지수", "제니", "로제", "리사"]},
        "grades": [
            {"grade": "VIP", "price": 210000, "color": "#FFD700"},
            {"grade": "R", "price": 160000, "color": "#C0C0C0"}
        ],
        "createdAt": "2026-01-14"
    },
    {
        "performanceId": "perf-day6-present",
        "title": "DAY6",
        "venueId": "charlotte-theater",
        "venue": "KSPO DOME",
        "posterUrl": "/posters/day6.png",
        "dates": ["2026-03-27", "2026-03-28", "2026-03-29"],
        "times": ["18:00"],
        "dateRange": "2026.03.27 - 2026.03.29",
        "description": "DAY6 The Present - 데이식스 콘서트",
        "duration": "160분",
        "runtime": "약 2시간 40분",
        "ageRating": "전체 관람가",
        "price": "VIP석 150,000원",
        "cast": {"day6": ["성진", "Young K", "원필", "도운"]},
        "grades": [
            {"grade": "VIP", "price": 150000, "color": "#FFD700"},
            {"grade": "R", "price": 120000, "color": "#C0C0C0"}
        ],
        "createdAt": "2026-01-14"
    },
    {
        "performanceId": "perf-ive-showhave",
        "title": "아이브",
        "venueId": "charlotte-theater",
        "venue": "KSPO DOME",
        "posterUrl": "/posters/ive.png",
        "dates": ["2026-02-27", "2026-02-28", "2026-03-01"],
        "times": ["18:00"],
        "dateRange": "2026.02.27 - 2026.03.01",
        "description": "IVE SHOW WHAT I HAVE ENCORE - 아이브의 앙코르 콘서트",
        "duration": "150분",
        "runtime": "약 2시간 30분",
        "ageRating": "전체 관람가",
        "price": "VIP석 200,000원",
        "cast": {"ive": ["안유진", "가을", "레이", "장원영", "리즈", "이서"]},
        "grades": [
            {"grade": "VIP", "price": 200000, "color": "#FFD700"},
            {"grade": "R", "price": 150000, "color": "#C0C0C0"}
        ],
        "createdAt": "2026-01-14"
    }
]

for concert in concerts:
    try:
        table.put_item(Item=concert)
        print(f"✅ 추가 완료: {concert['title']}")
    except Exception as e:
        print(f"❌ 실패: {concert['title']} - {e}")

print("\n모든 콘서트 데이터 추가 완료!")
