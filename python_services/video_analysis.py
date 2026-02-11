import cv2
import numpy as np
from deepface import DeepFace
import os

# Initialize MediaPipe Face Mesh with version compatibility
USE_MEDIAPIPE = False
face_mesh = None
mp_face_mesh = None

try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.3,  # Lower threshold for better detection
        min_tracking_confidence=0.3
    )
    USE_MEDIAPIPE = True
    print("MediaPipe Face Mesh loaded successfully")
except (AttributeError, ImportError) as e:
    print(f"MediaPipe not available or version incompatible: {e}")
    print("Video analysis will use DeepFace only (no eye tracking)")

def analyze_video(video_path):
    """
    Analyzes a video for:
    1. Eye Contact (Percentage of time looking at camera)
    2. Facial Emotion (Dominant emotion over time)
    3. Nervousness (Head movement stability)
    """
    global face_mesh, USE_MEDIAPIPE
    
    if not os.path.exists(video_path):
        return {"error": "Video file not found"}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": "Could not open video"}

    frame_count = 0
    looking_at_camera_frames = 0
    face_detected_frames = 0
    emotions_list = []
    
    # Head Pose Tracking for Nervousness
    prev_nose_x = 0
    prev_nose_y = 0
    movement_score = 0

    # Sample rate for DeepFace (it's slow)
    emotion_sample_rate = 30 # Analyze every 30th frame (approx 1 sec)

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        frame_count += 1
        h, w, _ = image.shape
        
        # Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # MediaPipe Face Mesh for eye contact
        if USE_MEDIAPIPE and face_mesh is not None:
            results = face_mesh.process(rgb_image)

            if results.multi_face_landmarks:
                face_detected_frames += 1
                for face_landmarks in results.multi_face_landmarks:
                    # --- 1. Eye Contact Detection ---
                    # Left Iris: 468, 473
                    # Right Iris: 474, 478
                    
                    left_iris = face_landmarks.landmark[468]
                    right_iris = face_landmarks.landmark[473]
                    
                    # Simple Heuristic: If iris is centered horizontally in the eye
                    # (This is a simplified check for the MVP)
                    # A more robust one requires calibration, but we assume webcam center alignment
                    
                    # Check nose tip (1) for general head orientation
                    nose_tip = face_landmarks.landmark[1]
                    nose_x, nose_y = nose_tip.x, nose_tip.y
                    
                    # If nose is roughly centered (0.25 to 0.75), assume looking towards screen
                    # Widened the range for better detection
                    if 0.25 < nose_x < 0.75 and 0.25 < nose_y < 0.75:
                         looking_at_camera_frames += 1

                    # --- 2. Nervousness (Head Movement) ---
                    if frame_count > 1:
                        dist = np.sqrt((nose_x - prev_nose_x)**2 + (nose_y - prev_nose_y)**2)
                        movement_score += dist
                    
                    prev_nose_x = nose_x
                    prev_nose_y = nose_y

        # --- 3. Emotion Analysis (DeepFace) ---
        if frame_count % emotion_sample_rate == 0:
            try:
                # DeepFace expects BGR or RGB. We pass BGR (image)
                # enforce_detection=False to avoid crash if face not found in that specific frame
                objs = DeepFace.analyze(img_path=image, actions=['emotion'], enforce_detection=False, silent=True)
                if objs:
                    dom_emotion = objs[0]['dominant_emotion']
                    emotions_list.append(dom_emotion)
            except Exception as e:
                pass # Skip frame on error

    cap.release()

    # --- Compile Results ---
    
    # Eye Contact Score (based on frames where face was detected)
    eye_contact_score = 0
    if face_detected_frames > 0:
        eye_contact_score = round((looking_at_camera_frames / face_detected_frames) * 100, 1)
    
    # Debug info
    print(f"  Frames: {frame_count}, Face detected: {face_detected_frames}, Looking at camera: {looking_at_camera_frames}")

    # Dominant Emotion
    final_emotion = "Neutral"
    if emotions_list:
        final_emotion = max(set(emotions_list), key=emotions_list.count)
    
    # Nervousness Score (Lower is better usually, but high means fidgeting)
    # Normalize by frame count
    avg_movement = 0
    if frame_count > 0:
        avg_movement = movement_score / frame_count
    
    nervousness_rating = "Low"
    if avg_movement > 0.005: nervousness_rating = "Medium"
    if avg_movement > 0.01: nervousness_rating = "High (Fidgeting Detected)"

    return {
        "Eye Contact": f"{eye_contact_score}%",
        "Dominant Emotion": final_emotion.capitalize(),
        "Nervousness": nervousness_rating,
        "Total Frames": frame_count
    }
