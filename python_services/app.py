from flask import Flask, request, jsonify
from flask_cors import CORS
# import model_gaze # Processed lazily
import model_jd
import audio_analysis
import numpy as np
import cv2
import base64
import whisper
import tempfile
import os

# STABILITY FIX: Force CPU to avoid CUDA/BLAS conflicts betweeen TF, Torch, Librosa
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

# Initialize Whisper Model (Lazy load or global)
# explicitly CPU to avoid CUDA errors if not set up, or let it auto-detect
print("Loading Whisper model...")
model = whisper.load_model("base") 
print("Whisper model loaded.")

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

@app.route('/transcribe', methods=['POST'])
def transcribe_route():
    try:
        if 'file' not in request.files and 'filePath' not in request.form:
             return jsonify({'error': 'No file provided'}), 400

        # Support both direct upload or path reference (since Node saves it locally)
        target_path = ""
        is_temp = False

        if 'filePath' in request.form:
             # Security: Ensure path is within allowed dir in real app
             target_path = request.form['filePath']
             if not os.path.exists(target_path):
                 return jsonify({'error': 'File not found'}), 404
        else:
             file = request.files['file']
             fd, target_path = tempfile.mkstemp(suffix=".webm")
             os.close(fd)
             file.save(target_path)
             is_temp = True

        # Transcribe
        print(f"Starting Whisper transcription for {target_path}...")
        result = model.transcribe(target_path)
        print("Whisper transcription complete.")
        text = result["text"]

        # Audio Analysis
        print("Starting Audio Analysis...")
        audio_res = audio_analysis.analyze_audio(target_path, text)
        print("Audio Analysis complete.")

        # Video Analysis
        print("Starting Video Analysis (MediaPipe + DeepFace)...")
        try:
            import video_analysis
            video_res = video_analysis.analyze_video(target_path)
            print("Video Analysis complete.")
        except Exception as va_err:
            print(f"Video Analysis Failed: {va_err}")
            video_res = {"error": "Video analysis failed"}

        # Merge Results
        analysis = {**audio_res, **video_res}

        if is_temp:
            os.remove(target_path)
            print("Temp file removed.")

        return jsonify({
            'text': text.strip(),
            'analysis': analysis
        })

    except Exception as e:
        print("Transcription Error:", e)
        return jsonify({'error': str(e)}), 500

        return jsonify({'error': str(e)}), 500

@app.route('/gaze-detect', methods=['POST'])
def gaze_detect_route():
    try:
        # Lazy load to avoid TF/PyTorch startup conflicts
        import model_gaze
        
        data = request.json
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400

        # Decode base64
        image_data = base64.b64decode(data['image'].split(',')[1])
        np_arr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'error': 'Image decode failed'}), 400

        result = model_gaze.detect_gaze(img)
        return jsonify(result)

    except Exception as e:
        print("Gaze Error:", e)
        return jsonify({'error': 'Processing failed'}), 500

@app.route('/compare-jd', methods=['POST'])
def compare_jd_run():
    try:
        if 'cv' not in request.files or 'jobDescription' not in request.form:
             return jsonify({'error': 'Missing CV or JD'}), 400
        
        cv_file = request.files['cv']
        jd_text = request.form['jobDescription']
        
        cv_bytes = cv_file.read()
        score, missing, cv_text = model_jd.compare_jd_cv(jd_text, cv_bytes, cv_file.filename)
        
        return jsonify({'score': score, 'missing': missing, 'cvText': cv_text})

    except Exception as e:
        print("JD Error:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/extract-text', methods=['POST'])
def extract_text_route():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        text = ""
        if file.filename.lower().endswith('.pdf'):
            # Use module_jd parsed method or simple here
            text = model_jd.extract_text_from_pdf_bytes(file.read())
        else:
            # Assume text/plain
            text = file.read().decode('utf-8', errors='ignore')
            
        return jsonify({'text': text.strip()})

    except Exception as e:
        print("Extract Error:", e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Python AI Service on port 5000 (Production Logic)...")
    # debug=False is important for stability with heavy ML models
    app.run(debug=False, port=5000, threaded=True)
