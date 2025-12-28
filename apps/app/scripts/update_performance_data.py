import boto3
import json
from datetime import datetime, timedelta
import re

import os
# AWS Configuration
session = boto3.Session(region_name=os.environ.get('AWS_REGION', 'ap-northeast-2'))
dynamodb = session.resource('dynamodb')

PERFORMANCES_TABLE = os.environ.get("DYNAMODB_PERFORMANCES_TABLE", "KDT-Msp4-PLDR-performances")
SCHEDULES_TABLE = os.environ.get("DYNAMODB_SCHEDULES_TABLE", "KDT-Msp4-PLDR-schedules")
VENUES_TABLE = os.environ.get("DYNAMODB_VENUES_TABLE", "KDT-Msp4-PLDR-venues")

DAY_MAP = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 }
REVERSE_DAY_MAP = ["일", "월", "화", "수", "목", "금", "토"]

def parse_schedule_rule(schedule_str):
    if not schedule_str: return {}
    parts = [p.strip() for p in schedule_str.split("/")]
    rule = {}
    for part in parts:
        # Match days and times. e.g., "화, 목, 금 19:30" or "토, 일 14:00, 19:00"
        match = re.match(r'^([가-힣\s,~]+)\s+([0-9:,/\s]+)$', part)
        if match:
            day_part = match.group(1).replace(" ", "")
            times = [t.strip() for t in match.group(2).split(",")]
            
            # Split by comma for multiple days
            days_raw = day_part.split(",")
            for d in days_raw:
                if "~" in d:
                    start_day, end_day = d.split("~")
                    start_idx = DAY_MAP[start_day]
                    end_idx = DAY_MAP[end_day]
                    for i in range(start_idx, end_idx + 1):
                        rule[REVERSE_DAY_MAP[i]] = times
                elif d in DAY_MAP:
                    rule[d] = times
    return rule

def get_venues_map():
    table = dynamodb.Table(VENUES_TABLE)
    response = table.scan()
    return {v['venueId']: int(v.get('totalSeats', 1240)) for v in response.get('Items', [])}

def delete_existing_schedules(perf_id):
    table = dynamodb.Table(SCHEDULES_TABLE)
    # Using scan to find items to delete (safe for small table size ~300 items)
    response = table.scan(
        FilterExpression=boto3.dynamodb.conditions.Attr('performanceId').eq(perf_id)
    )
    items = response.get('Items', [])
    if not items: return
    
    print(f"  - Deleting {len(items)} existing schedules for {perf_id}...")
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={'scheduleId': item['scheduleId']})

def run_update():
    perf_table = dynamodb.Table(PERFORMANCES_TABLE)
    sched_table = dynamodb.Table(SCHEDULES_TABLE)
    venues_map = get_venues_map()

    print("Scanning performances...")
    response = perf_table.scan()
    performances = response.get('Items', [])

    for perf in performances:
        pid = perf.get('performanceId') or perf.get('id')
        title = perf.get('title')
        venue_id = perf.get('venueId', 'charlotte-theater')
        total_seats = venues_map.get(venue_id, 1240)
        
        print(f"Processing: {title} ({pid})...")

        # 1. Clean existing schedules to avoid duplicates
        delete_existing_schedules(pid)

        # 2. Generate Schedules
        schedule_rule = parse_schedule_rule(perf.get('schedule', ""))
        start_date = datetime.strptime(perf.get('startDate'), '%Y-%m-%d')
        end_date = datetime.strptime(perf.get('endDate'), '%Y-%m-%d')
        
        # Casting from Performance
        casting_info = perf.get('cast', [])

        schedules_meta = []
        curr = start_date
        while curr <= end_date:
            date_str = curr.strftime('%Y-%m-%d')
            # datetime.weekday(): 0=Mon ... 6=Sun
            # REVERSE_DAY_MAP: 0=Sun, 1=Mon ...
            day_name = REVERSE_DAY_MAP[(curr.weekday() + 1) % 7]
            
            times = schedule_rule.get(day_name)
            if times:
                entry = {
                    "date": date_str,
                    "dayOfWeek": day_name,
                    "times": [{"time": t, "availableSeats": total_seats, "status": "available"} for t in times]
                }
                schedules_meta.append(entry)
                
                # Write to Schedules Table
                with sched_table.batch_writer() as batch:
                    for t in entry["times"]:
                        batch.put_item(
                            Item={
                                "scheduleId": f"{pid}-{date_str}-{t['time']}",
                                "performanceId": pid,
                                "date": date_str,
                                "time": t["time"],
                                "datetime": f"{date_str}T{t['time']}",
                                "dayOfWeek": day_name,
                                "availableSeats": total_seats,
                                "totalSeats": total_seats,
                                "casting": casting_info,
                                "status": "AVAILABLE",
                                "createdAt": datetime.utcnow().isoformat() + "Z"
                            }
                        )
            curr += timedelta(days=1)

        # Update schedules field in Performance (for UI list)
        perf_table.update_item(
            Key={'performanceId': pid},
            UpdateExpression="SET schedules = :s",
            ExpressionAttributeValues={":s": schedules_meta}
        )
        print(f"  - Generated {len(schedules_meta)} days of schedules.")

if __name__ == "__main__":
    run_update()
    print("All tasks completed successfully.")
