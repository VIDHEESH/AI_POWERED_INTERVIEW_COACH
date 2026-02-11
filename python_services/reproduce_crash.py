
import os
import sys
import traceback

print("Starting reproduction script...")

try:
    print("Importing Whisper...")
    import whisper
    print("Whisper imported.")

    print("Importing audio_analysis...")
    import audio_analysis
    print("audio_analysis imported.")
    
    # Path from the error log
    file_path = r"D:\Interview_Coach\uploads\video-1770377968214-633187910.webm"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)
        
    print(f"Loading model... (File size: {os.path.getsize(file_path)/1024/1024:.2f} MB)")
    model = whisper.load_model("base")
    print("Model loaded.")
    
    print("Starting transcription...")
    result = model.transcribe(file_path)
    text = result["text"]
    print("Transcription complete.")
    print(f"Text length: {len(text)}")
    
    print("Starting audio analysis...")
    analysis = audio_analysis.analyze_audio(file_path, text)
    print("Audio analysis complete.")
    print("Result:", analysis)
    
except Exception:
    traceback.print_exc()
