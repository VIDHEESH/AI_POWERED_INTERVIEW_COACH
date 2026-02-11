import cv2
import numpy as np
from collections import deque
from fer.fer import FER
import tensorflow as tf

# Limit TF memory growth if possible to avoid hogging
try:
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
except:
    pass

# Load Cascades
p = cv2.data.haarcascades
face_cascade = cv2.CascadeClassifier(p + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(p + 'haarcascade_eye.xml')

# Initialize FER Detector
print("Loading Emotion Detector...")
detector = None
try:
    # FER can cause crashes on some Windows environments with TF conflicts
    # We will try to load it, but if it fails, we continue without it.
    print("Initializing Default Emotion Detector (OpenCV)...")
    detector = FER(mtcnn=False) 
    print("Emotion Detector (Default) Loaded.")
except Exception as e:
    print(f"MTCNN Load Warning: {e}. Trying default cascade...")
    try:
        detector = FER()
        print("Emotion Detector (Default) Loaded.")
    except Exception as e2:
         print(f"CRITICAL WARNING: Emotion Detector Failed to Load: {e2}. Emotion analysis will be disabled.")
         detector = None

# Global History
HISTORY_LEN = 30
face_x_hist = deque(maxlen=HISTORY_LEN)
eye_x_hist = deque(maxlen=HISTORY_LEN)
eye_y_hist = deque(maxlen=HISTORY_LEN)

def detect_gaze(image_bgr):
    # SAFETY: Basic Image Validation
    if image_bgr is None or image_bgr.size == 0:
        return {"status": "AWAY", "emotion": "Error", "gaze_state": "Invalid Image", "eye_coords": []}

    try:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        
        if height == 0 or width == 0:
             return {"status": "AWAY", "emotion": "Error", "gaze_state": "Empty Image", "eye_coords": []}
    except Exception as e:
        print("Image Conversion Error:", e)
        return {"status": "AWAY", "emotion": "Error", "gaze_state": "Conversion Error", "eye_coords": []}

    # 1. Face Detection
    try:
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
    except Exception as e:
        print("Face Detect Error:", e)
        faces = []

    if len(faces) == 0:
        face_x_hist.clear()
        return {"status": "AWAY", "emotion": "Unknown", "gaze_state": "No Face Found", "eye_coords": []}

    # Largest Face
    faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
    (fx, fy, fw, fh) = faces[0]
    
    # Validation
    if fw <= 0 or fh <= 0:
        return {"status": "AWAY", "emotion": "Error", "gaze_state": "Invalid Face Box", "eye_coords": []}

    face_gray = gray[fy:fy+fh, fx:fx+fw]
    
    # Normalize Face Center (0.0 to 1.0)
    face_cx = (fx + fw/2) / width
    face_x_hist.append(face_cx)

    # ---------------------------
    # EMOTION ANALYSIS (FER)
    # ---------------------------
    emotion = "Neutral"
    if detector:
        try:
            # FIX: Pass a contiguous copy to avoid "internal data" errors from TensorFlow/NumPy interaction
            fer_input = np.ascontiguousarray(image_bgr)
            top_emotions = detector.detect_emotions(fer_input)
            
            if top_emotions:
                largest_face = max(top_emotions, key=lambda x: x['box'][2] * x['box'][3])
                
                # Get max scoring emotion
                emotions = largest_face['emotions']
                dom_emotion = max(emotions, key=emotions.get)
                emotion = dom_emotion.capitalize() # e.g., "Happy", "Angry"
                
        except Exception as e:
            # print("FER Error:", e) # Suppress FER noise
            emotion = "Neutral"

    # ---------------------------
    # CHEATING / EYE PATTERNS
    # ---------------------------
    eyes = []
    try:
        if face_gray.size > 0:
            eyes = eye_cascade.detectMultiScale(face_gray, 1.1, 3) 
    except Exception as e:
        print("Eye Cascade Error:", e)

    gaze_state = "Focused"

    # Moving Aside (Strict: Must be within 15% - 85%)
    if face_cx < 0.15 or face_cx > 0.85:
        gaze_state = "Moving Aside"
        return {"status": "AWAY", "emotion": emotion, "gaze_state": gaze_state, "eye_coords": []}

    if len(eyes) >= 1:
        (ex, ey, ew, eh) = eyes[0]
        eye_cx = (ex + ew/2) / fw
        eye_cy = (ey + eh/2) / fh
        
        eye_x_hist.append(eye_cx)
        eye_y_hist.append(eye_cy)
        
        if len(eye_x_hist) > 10:
            std_x = np.std(eye_x_hist) * 100 
            
            # Pattern 1: Reading (Sensitive)
            if std_x > 0.8: 
                gaze_state = "Reading Screen"
            
            # Pattern 2: Searching
            elif std_x > 2.0:
                gaze_state = "Searching / Darting"

    elif len(eyes) == 0:
        # Relaxed: If face is present but eyes aren't detected (common with glasses/lighting),
        # assume they are present and looking generally forward.
        gaze_state = "Face Detected"

    # Calculate Eye Coordinates for Tracing
    eye_coords = []
    for (ex, ey, ew, eh) in eyes:
        global_cx = fx + ex + ew/2
        global_cy = fy + ey + eh/2
        norm_x = global_cx / width
        norm_y = global_cy / height
        eye_coords.append({"x": norm_x, "y": norm_y})

    return {
        "status": "CENTER" if gaze_state != "Moving Aside" and gaze_state != "Looking Down / At Notes" else "AWAY",
        "emotion": emotion,
        "gaze_state": gaze_state,
        "eye_coords": eye_coords
    }
