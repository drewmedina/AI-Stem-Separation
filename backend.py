from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import torch
import numpy as np
import librosa
import soundfile as sf
from neural_net import UNet

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {"origins": "*"},
    r"/stems/*": {"origins": "*"}
})

UPLOAD_FOLDER = 'uploads'
STEMS_FOLDER = 'stems'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STEMS_FOLDER, exist_ok=True)

# Model and separation settings
MODEL_PATH = 'models/vocal_separator_unet.pt'
N_FFT = 1024
HOP_LENGTH = 256
MAX_FRAMES = 512
OVERLAP = 64
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Load model at startup
model = UNet().to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()

def istft(stft):
    return librosa.istft(stft, hop_length=HOP_LENGTH)

def separate_vocals(mixture_path, vocals_path, instruments_path):
    S, sr = librosa.load(mixture_path, sr=None)
    stft = librosa.stft(S, n_fft=N_FFT, hop_length=HOP_LENGTH, window='hann')
    mag = np.abs(stft)
    phase = np.angle(stft)
    T_tot = mag.shape[1]
    pred_mag = np.zeros_like(mag)
    counts = np.zeros(T_tot)
    step = MAX_FRAMES - OVERLAP
    t = 0
    while t + MAX_FRAMES <= T_tot:
        seg = mag[:, t : t + MAX_FRAMES]
        mix_log = np.log1p(seg)[None, None, :, :]
        m_t = torch.from_numpy(mix_log).float().to(DEVICE)
        with torch.no_grad():
            out = model(m_t)
            pred = out.squeeze(0).squeeze(0).cpu().numpy()
        pred_mag[:, t : t + MAX_FRAMES] += seg * pred
        counts[t : t + MAX_FRAMES] += 1
        t += step
    if t < T_tot:
        rem = mag[:, t:]
        pad = MAX_FRAMES - rem.shape[1]
        seg = np.pad(rem, ((0,0),(0,pad)), mode="constant")
        mix_log = np.log1p(seg)[None, None, :, :]
        m_t = torch.from_numpy(mix_log).float().to(DEVICE)
        with torch.no_grad():
            out = model(m_t)
            pred = out.squeeze(0).squeeze(0).cpu().numpy()[:, : rem.shape[1]]
        pred_mag[:, t:] += rem * pred
        counts[t:] += 1
    counts = np.maximum(counts, 1.0)
    pred_mag /= counts[None, :]
    S_vocals = pred_mag * np.exp(1j * phase)
    y_vocals = istft(S_vocals)
    sf.write(vocals_path, y_vocals, sr)
    # Instrumental = mixture - vocals (in time domain)
    y_mixture, _ = librosa.load(mixture_path, sr=sr)
    y_vocals_aligned, _ = librosa.load(vocals_path, sr=sr)
    y_instruments = y_mixture[:len(y_vocals_aligned)] - y_vocals_aligned
    sf.write(instruments_path, y_instruments, sr)

@app.route('/api/separate', methods=['POST'])
def separate():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    base, _ = os.path.splitext(secure_filename(file.filename))
    temp_upload_path = os.path.join(UPLOAD_FOLDER, base + '_orig')
    file.save(temp_upload_path)

    # Convert to real .wav using librosa and soundfile
    wav_upload_path = os.path.join(UPLOAD_FOLDER, base + '.wav')
    try:
        audio, sr = librosa.load(temp_upload_path, sr=None)
        sf.write(wav_upload_path, audio, sr)
    except Exception as e:
        return jsonify({'error': f'Failed to convert to wav: {str(e)}'}), 500

    vocals_path = os.path.join(STEMS_FOLDER, f'vocals_{base}.wav')
    instruments_path = os.path.join(STEMS_FOLDER, f'instruments_{base}.wav')
    try:
        separate_vocals(wav_upload_path, vocals_path, instruments_path)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({
        'vocals': f'/stems/{os.path.basename(vocals_path)}',
        'instruments': f'/stems/{os.path.basename(instruments_path)}'
    })

@app.route('/stems/<path:filename>')
def download_stem(filename):
    file_path = os.path.join(STEMS_FOLDER, filename)
    print(f"[DOWNLOAD] Requested: {file_path} Exists: {os.path.exists(file_path)}")
    response = send_from_directory(STEMS_FOLDER, filename, as_attachment=True)
    # Add CORS headers explicitly for the stems endpoint
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0') 