import numpy as np
import librosa

def analyze_audio(file_path, transcription_text):
    print(f"Analyzing audio: {file_path}")
    try:
        # Load audio (downsample to 16kHz for speed, mono)
        # Fix: Use try-except for loading specifically
        try:
            y, sr = librosa.load(file_path, sr=16000)
        except Exception as load_err:
            print(f"Librosa Load Failed: {load_err}")
            # Fallback for duration if load fails (approx from file size? No, just return safe defaults)
            return default_analysis()

        duration = librosa.get_duration(y=y, sr=sr)
        if duration == 0: return default_analysis()

        # 1. Pitch Analysis (Fundamental Frequency F0)
        pitch_mean = 0
        pitch_std = 0
        try:
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            indices = magnitudes.argmax(axis=0)
            pitch_values = pitches[indices, range(magnitudes.shape[1])]
            pitch_values = pitch_values[pitch_values > 50] # Human speech > 50Hz
            
            if len(pitch_values) > 0:
                pitch_mean = float(np.mean(pitch_values))
                pitch_std = float(np.std(pitch_values))
        except Exception as p_err:
            print(f"Pitch Analysis Failed: {p_err}")

        # 2. Speech Rate
        word_count = len(transcription_text.split())
        words_per_min = (word_count / duration) * 60

        # 3. Pauses (Silence detection)
        pause_ratio = 0
        try:
            non_silent_intervals = librosa.effects.split(y, top_db=20)
            non_silent_duration = sum(end - start for start, end in non_silent_intervals) / sr
            pause_duration = duration - non_silent_duration
            pause_ratio = pause_duration / duration
        except Exception as s_err:
            print(f"Silence Detection Failed: {s_err}")
        
        # 4. Filter Words (Text Analysis)
        text_lower = transcription_text.lower()
        fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically']
        filler_count = sum(text_lower.count(f) for f in fillers)
        
        # 5. Scores
        clarity_score = 100 - abs(words_per_min - 140) 
        clarity_score = max(0, min(100, clarity_score))
        
        fluency_penalty = (filler_count * 5) + (max(0, pause_ratio - 0.2) * 100)
        fluency_score = max(0, min(100, 100 - fluency_penalty))

        # Generate Tips
        tips = generate_tips(words_per_min, filler_count, pitch_std)

        return {
            "duration": float(duration),
            "wpm": round(words_per_min, 1),
            "pitch_mean": round(pitch_mean, 1),
            "pitch_std": round(pitch_std, 1),
            "pause_ratio": round(pause_ratio, 2),
            "filler_count": filler_count,
            "clarity_score": round(clarity_score),
            "fluency_score": round(fluency_score),
            "tips": tips
        }

    except Exception as e:
        print(f"Audio Analysis General Error: {e}")
        return default_analysis()

def default_analysis():
    return {
        "duration": 0,
        "wpm": 0,
        "pitch_mean": 0,
        "pitch_std": 0,
        "pause_ratio": 0,
        "filler_count": 0,
        "clarity_score": 0,
        "fluency_score": 0,
        "tips": ["Audio analysis unavailable."]
    }

def generate_tips(wpm, fillers, pitch):
    tips = []
    if wpm > 160: tips.append("You are speaking a bit fast. Slow down.")
    elif wpm < 110: tips.append("Your pace is quite slow. Try to speak more fluidly.")
    
    if fillers > 3: tips.append(f"Detected {fillers} filler words. Pause instead of saying 'um'.")
    
    if pitch < 20: tips.append("Your tone appears monotone. Add variation.")
    return tips
