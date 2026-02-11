"""
Analyze All Interview Videos

This script runs video analysis (eye contact, emotion, nervousness) 
on all videos in the uploads folder and updates the database.

Usage: python analyze_all_videos.py
"""

import os
import sys
import psycopg2
from video_analysis import analyze_video

# Database connection
DATABASE_URL = "postgresql://postgres:post@localhost:5432/interview_coach"

def get_sessions_to_analyze():
    """Get all sessions that need video analysis"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Re-analyze ALL sessions (remove the Eye Contact check to force re-analysis)
    cur.execute("""
        SELECT id, video_url, analysis_results 
        FROM sessions 
        ORDER BY created_at DESC
    """)
    
    rows = cur.fetchall()
    conn.close()
    return rows

def update_session_analysis(session_id, video_analysis_data, existing_analysis):
    """Update session with video analysis results"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Merge with existing analysis
    merged = existing_analysis or {}
    merged.update(video_analysis_data)
    
    import json
    cur.execute(
        "UPDATE sessions SET analysis_results = %s WHERE id = %s",
        (json.dumps(merged), session_id)
    )
    
    conn.commit()
    conn.close()

def main():
    print("=== Video Analysis Script ===\n")
    
    # Get uploads directory
    uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    uploads_dir = os.path.abspath(uploads_dir)
    
    print(f"Uploads directory: {uploads_dir}\n")
    
    # Get sessions needing analysis
    sessions = get_sessions_to_analyze()
    print(f"Found {len(sessions)} sessions to analyze\n")
    
    if not sessions:
        print("All videos have been analyzed!")
        return
    
    success = 0
    failed = 0
    
    for session_id, video_url, existing_analysis in sessions:
        print(f"\n--- Session {session_id} ---")
        
        # Get video path
        filename = video_url.replace('/uploads/', '')
        video_path = os.path.join(uploads_dir, filename)
        
        if not os.path.exists(video_path):
            print(f"✗ Video not found: {video_path}")
            failed += 1
            continue
        
        print(f"Analyzing: {filename}")
        
        try:
            # Run video analysis
            result = analyze_video(video_path)
            
            if "error" in result:
                print(f"✗ Analysis error: {result['error']}")
                failed += 1
                continue
            
            print(f"✓ Eye Contact: {result.get('Eye Contact', 'N/A')}")
            print(f"✓ Emotion: {result.get('Dominant Emotion', 'N/A')}")
            print(f"✓ Nervousness: {result.get('Nervousness', 'N/A')}")
            
            # Update database
            update_session_analysis(session_id, result, existing_analysis)
            print("✓ Database updated")
            success += 1
            
        except Exception as e:
            print(f"✗ Error: {e}")
            failed += 1
    
    print(f"\n=== Complete ===")
    print(f"✓ Success: {success}")
    print(f"✗ Failed: {failed}")

if __name__ == "__main__":
    main()
