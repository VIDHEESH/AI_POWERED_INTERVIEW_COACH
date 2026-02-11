const fs = require('fs');
const path = require('path');

// Create a dummy webm file if not exists (just empty or text, whisper might fail on content but should hit route)
// Better: try to upload a real text file and see if it errors correctly, or just check 404 vs 500
// Actually, let's just use the fetch logic to hit the endpoint.

const testTranscribe = async () => {
    try {
        console.log("Testing /transcribe endpoint...");

        const dummyPath = path.resolve(__dirname, 'test_audio.wav');
        // Create a minimal valid WAV header (44 bytes) to satisfy ffmpeg
        const buffer = Buffer.alloc(44);
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36, 4); // ChunkSize
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16); // Subchunk1Size
        buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
        buffer.writeUInt16LE(1, 22); // NumChannels (1)
        buffer.writeUInt32LE(44100, 24); // SampleRate
        buffer.writeUInt32LE(88200, 28); // ByteRate
        buffer.writeUInt16LE(2, 32); // BlockAlign
        buffer.writeUInt16LE(16, 34); // BitsPerSample
        buffer.write('data', 36);
        buffer.writeUInt32LE(0, 40); // Subchunk2Size
        fs.writeFileSync(dummyPath, buffer);

        const formData = new FormData();
        formData.append('filePath', dummyPath);

        const res = await fetch('http://localhost:5000/transcribe', {
            method: 'POST',
            body: formData
        });

        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Response:", data);

        // Cleanup
        fs.unlinkSync(dummyPath);

    } catch (err) {
        console.error("Test Failed:", err);
    }
};

testTranscribe();
