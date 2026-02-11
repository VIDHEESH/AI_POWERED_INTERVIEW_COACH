from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
from pypdf import PdfReader
import io

def clean_text(text):
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    return text

def extract_text_from_pdf_bytes(pdf_bytes):
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        return text
    except Exception as e:
        print("PDF Read Error", e)
        return ""

def compare_jd_cv(jd_text, cv_file_bytes, filename):
    # Extract
    if filename.endswith('.pdf'):
        cv_text = extract_text_from_pdf_bytes(cv_file_bytes)
    else:
        cv_text = cv_file_bytes.decode('utf-8', errors='ignore')

    if not cv_text.strip():
        return 0.0, ["Could not read CV"], ""

    # Normalize
    clean_jd = clean_text(jd_text)
    clean_cv = clean_text(cv_text)

    # TF-IDF
    try:
        tfidf = TfidfVectorizer(stop_words='english')
        tfidf_matrix = tfidf.fit_transform([clean_jd, clean_cv])
        cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
        score = round(cosine_sim[0][0] * 100, 2)
        
        # Missing Keywords (heuristic: words in JD with high TF-IDF that are missing in CV)
        # Simplified: Just check set difference of top words
        jd_words = set(clean_jd.split())
        cv_words = set(clean_cv.split())
        
        # Simple set diff for now (filtering short words)
        missing = [w for w in jd_words if w not in cv_words and len(w) > 4]
        
        return score, missing[:10], cv_text
        
    except Exception as e:
        print("Comparison Error", e)
        return 0.0, [], ""
