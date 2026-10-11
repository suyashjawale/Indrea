import base64
import os
import shutil
import tempfile
import time
from typing import Optional
from fastapi import FastAPI
import numpy as np
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
import numpy as np
import mne
from fastapi.responses import StreamingResponse, JSONResponse
import gzip
import copy
from datetime import date
import sys
import json
import numpy as np
import io
from pydantic import BaseModel
from fastapi.responses import Response
import glob
from contextlib import asynccontextmanager
import matplotlib.pyplot as plt  
from mne.preprocessing import ICA
from scipy.signal import welch
import subprocess
from datetime import datetime
from pytz import timezone, UTC
from scipy.signal import welch
from scipy.integrate import simpson
from mne.time_frequency import psd_array_multitaper
from scipy.stats import skew, kurtosis
from fastapi import Query

@asynccontextmanager
async def lifespan(app: FastAPI):    
    yield  # <-- App runs here

    # --- Shutdown logic ---
    print("App is shutting down. Cleaning up EDF files...")
    temp_dir = tempfile.gettempdir()
    pattern = os.path.join(temp_dir, "brasig_edf_*.edf")
    for file_path in glob.glob(pattern):
        try:
            os.remove(file_path)
            print(f"Deleted: {file_path}")
        except Exception as e:
            print(f"Failed to delete {file_path}: {e}")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAW_STORAGE = []

VIDEO_FILE = "uploaded_video.mp4"
EEG_FILE = "uploaded_eeg.fif"

class CropRequest(BaseModel):
    videoStart: float
    videoEnd: float
    eegStart: float
    eegEnd: float

@app.get("/")
def read_root():
    return True

@app.post("/upload-edf")
async def upload_edf(file: UploadFile = File(...)):
    global RAW_STORAGE
    tmp_path = None  # Declare here so we can access in finally

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".edf", prefix="brasig_edf_") as tmp:
            tmp_path = tmp.name
            shutil.copyfileobj(file.file, tmp)

        # Now that the file is closed, MNE can access it
        raw = mne.io.read_raw_edf(tmp_path, preload=False)

        RAW_STORAGE.clear()
        RAW_STORAGE.append({"raw": raw})
        emotiv_eeg_channels = ['AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1', 'O2','P8', 'T8', 'FC6', 'F4', 'F8', 'AF4']

        return {"all_channels": raw.ch_names, "eeg_channels":emotiv_eeg_channels}
    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=400)


class ChannelRequest(BaseModel):
    selected_ch: list[str]
    montage: str

@app.post("/select-montage")
async def select_montage(data: ChannelRequest):
    global RAW_STORAGE
    if not RAW_STORAGE:
        return JSONResponse(content={"error": "No EDF file uploaded"}, status_code=400)
    raw = RAW_STORAGE[0]["raw"].copy() 
    raw.load_data()
    raw.pick(data.selected_ch)
    full_montage = mne.channels.make_standard_montage(data.montage)
    positions = full_montage.get_positions()["ch_pos"]
    selected_positions = {ch: pos for ch, pos in positions.items() if ch in data.selected_ch}
    if len(selected_positions)==len(data.selected_ch):
        custom_montage = mne.channels.make_dig_montage(ch_pos=selected_positions, coord_frame='head')
        raw.set_montage(custom_montage)

        # Generate sensor plot and save to buffer
        fig = raw.plot_sensors(show_names=True, show=False)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)  # Free memory
        buf.seek(0)

        return Response(content=buf.read(), media_type="image/png")
    else:
        return JSONResponse(content={"error": f"Coordinates for these channels {", ".join(list(data.selected_ch-selected_positions.keys()))} are unavailable in {data.montage} system"}, status_code=400)
    

@app.post("/select-channel")
async def select_channel(data: ChannelRequest):
    global RAW_STORAGE
    if not RAW_STORAGE:
        return JSONResponse(content={"error": "No EDF file uploaded"}, status_code=400)   
    
    raw = RAW_STORAGE[0].get("raw").copy()   
    raw.load_data()
    raw.pick(data.selected_ch)
    full_montage = mne.channels.make_standard_montage(data.montage)
    positions = full_montage.get_positions()["ch_pos"]
    selected_positions = {ch: pos for ch, pos in positions.items() if ch in data.selected_ch}
    if len(selected_positions)==len(data.selected_ch):
        custom_montage = mne.channels.make_dig_montage(ch_pos=selected_positions, coord_frame='head')
        raw.set_montage(custom_montage)
    RAW_STORAGE[0]["raw"]=raw
    data_uv = (raw.get_data() * 1e6).astype(np.float32)  
    times = raw.times.astype(np.float32)  
    
    # Convert NumPy arrays to binary format
    np_bytes = io.BytesIO()
    np.savez_compressed(np_bytes, data=data_uv, times=times)
    np_bytes.flush()  # Instead of seek(0), use flush()
    # Compress using Gzip
    compressed_data = gzip.compress(np_bytes.getvalue())
    return Response(content=compressed_data, media_type="application/octet-stream")


@app.get("/get-signal")
async def select_channel():
    global RAW_STORAGE
    if not RAW_STORAGE:
        return JSONResponse(content={"error": "No EDF file uploaded"}, status_code=400)   
    
    raw = RAW_STORAGE[-1].get("raw").copy()
    raw.load_data()
    data_uv = (raw.get_data() * 1e6).astype(np.float32)  
    times = raw.times.astype(np.float32)  
    
    # Convert NumPy arrays to binary format
    np_bytes = io.BytesIO()
    np.savez_compressed(np_bytes, data=data_uv, times=times)
    np_bytes.flush()  # Instead of seek(0), use flush()
    # Compress using Gzip
    compressed_data = gzip.compress(np_bytes.getvalue())
    return Response(content=compressed_data, media_type="application/octet-stream")


@app.post("/apply-filter")
async def apply_filter(l_freq: Optional[float] = Form(None),
    h_freq: Optional[float] = Form(None)):
    # Apply filters and return 
    #  EEG data with correct downsampling.

    # # Validations if necessary
    if not l_freq and not h_freq:
        return JSONResponse(content={"error": "Please provide frequency"}, status_code=400)
    
    # global RAW_STORAGE
    if not RAW_STORAGE:
        return JSONResponse(content={"error": "No EDF file uploaded"}, status_code=400)   

    raw = RAW_STORAGE[-1].get("raw").copy()
    try:
        ica = RAW_STORAGE[-1].get("ica").copy()
    except:
        ica = RAW_STORAGE[-1].get("ica")
    # # Ensure data is in memory
    raw.load_data()

    raw.filter(l_freq=l_freq, h_freq=h_freq, fir_design='firwin')

    RAW_STORAGE.append({"raw":raw,"ica":ica, "task": "apply filter"})

    data_uv = (raw.get_data() * 1e6).astype(np.float32)  

    # # Convert NumPy arrays to binary format
    np_bytes = io.BytesIO()
    np.savez_compressed(np_bytes, data=data_uv)
    np_bytes.flush()  # Instead of seek(0), use flush()

    # # Compress using Gzip
    compressed_data = gzip.compress(np_bytes.getvalue())

    return Response(content=compressed_data, media_type="application/octet-stream")

@app.post("/apply-ica")
async def apply_ica(n_components: int = Form(...),
    max_iter: int = Form(...),
    random_state: int = Form(...)):
    if not RAW_STORAGE:
        return JSONResponse(content={"error": "No EDF file uploaded"}, status_code=400)

    try:
        raw = RAW_STORAGE[-1].get("raw").copy()
        raw.load_data()

        # Set up ICA
        ica = ICA(
            n_components=n_components,
            random_state=random_state,
            max_iter=max_iter
        )

        reject_criteria = dict(eeg=200e-6)  # Amplitude-based rejection

        # Fit ICA
        ica.fit(raw, reject=reject_criteria, flat=None, reject_by_annotation=True)
        RAW_STORAGE.append({
            "raw": raw,
            "ica": ica,
            "task": "apply-ica"
        })
        # Plot ICA components
        fig = ica.plot_components(show=False)

        # Save the figure to a buffer
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)  # Close to free memory
        buf.seek(0)
        return Response(content=buf.read(), media_type="image/png")
    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=400)
    
@app.get("/save-raw-file")
async def save_raw_file():
    if not RAW_STORAGE or "ica" not in RAW_STORAGE[-1]:
        return JSONResponse(content={"error": "ICA not applied yet"}, status_code=400)

    try:
        raw = RAW_STORAGE[-1]["raw"].copy()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".fif") as tmpfile:
            tmp_path = tmpfile.name

        raw.save(tmp_path, overwrite=True)  # Save to file path

        def file_iterator():
            with open(tmp_path, "rb") as f:
                yield from f

            os.remove(tmp_path)  # Clean up temp file after sending

        return StreamingResponse(
            file_iterator(),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=raw_{date.today()}.fif"
            }
        )

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)



@app.get("/ica-spectrum")
async def ica_spectrum():
    if not RAW_STORAGE or "ica" not in RAW_STORAGE[-1]:
        return JSONResponse(content={"error": "ICA not applied yet"}, status_code=400)
    try:
        raw = RAW_STORAGE[-1]["raw"].copy()
        ica = RAW_STORAGE[-1]["ica"]
        sources = ica.get_sources(raw).get_data()
        sfreq = raw.info["sfreq"]

        # Compute PSD for each ICA component using Welch method
        psds = []
        freqs = None
        for component_data in sources:
            f, p = welch(component_data, fs=sfreq, nperseg=1024, noverlap=512)
            psds.append(10 * np.log10(p))  # Convert power to dB
            if freqs is None:
                freqs = f

        psds = np.array(psds, dtype=np.float32)

        # Compress and send data
        np_bytes = io.BytesIO()
        np.savez_compressed(np_bytes, freqs=freqs.astype(np.float32), psds=psds)
        np_bytes.flush()
        compressed = gzip.compress(np_bytes.getvalue())

        return Response(content=compressed, media_type="application/octet-stream")
    except Exception as e:
        print("Error computing ICA spectrum:", e)
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/ica-timeseries")
async def ica_timeseries():
    if not RAW_STORAGE or "ica" not in RAW_STORAGE[-1]:
        return JSONResponse(content={"error": "ICA not applied yet"}, status_code=400)
    try:
        raw = RAW_STORAGE[-1].get("raw").copy()
        ica = RAW_STORAGE[-1]["ica"]
        sources = ica.get_sources(raw)  # Returns a RawArray
        times = sources.times
        data = sources.get_data().astype(np.float32)  # shape: (n_components, n_times)

        np_bytes = io.BytesIO()
        np.savez_compressed(np_bytes, times=times, data=data)
        np_bytes.flush()

        compressed = gzip.compress(np_bytes.getvalue())
        return Response(content=compressed, media_type="application/octet-stream")
    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=500)
    
@app.get("/get-mai")
async def get_mai():
    if not RAW_STORAGE or "ica" not in RAW_STORAGE[-1]:
        return JSONResponse(content={"error": "ICA not applied yet"}, status_code=400)
    try:
        raw = RAW_STORAGE[-1].get("raw").copy()
        ica = RAW_STORAGE[-1]["ica"]
        muscle_idx_auto, scores = ica.find_bads_muscle(raw) 
        return {"muscle_idx":muscle_idx_auto}
    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/rejectICA")
async def reject_ica(muscle_idx : list[int]):
    if not RAW_STORAGE or "ica" not in RAW_STORAGE[-1]:
        return JSONResponse(content={"error": "ICA not applied yet"}, status_code=400)
    try:
        raw = RAW_STORAGE[-1].get("raw").copy()
        try:
            ica = RAW_STORAGE[-1].get("ica").copy()
        except:
            ica = RAW_STORAGE[-1].get("ica")
        ica.exclude = muscle_idx
        ica.apply(raw)
        RAW_STORAGE.append({
            "raw": raw,
            "ica": ica,
            "task": "apply-ica"
        })
        return {"muscle_idx":"Components Excluded Successfully"}
    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=500)

class Annotation(BaseModel):
    onset: list[float]
    duration: list[float]
    description: list[str]

@app.post("/apply-annotations")
async def apply_annotations(payload: Annotation):
    if not RAW_STORAGE or "raw" not in RAW_STORAGE[-1]:
        return JSONResponse(content={"error": "No raw data available"}, status_code=400)
    try:
        # Copy and update the raw object
        raw = RAW_STORAGE[-1]["raw"].copy()
        try:
            ica = RAW_STORAGE[-1].get("ica").copy()
        except:
            ica = RAW_STORAGE[-1].get("ica")
        annotations = mne.Annotations(
            onset=payload.onset,
            duration=payload.duration,
            description=payload.description,
            orig_time=raw.info["meas_date"]
        )
        raw.set_annotations(annotations)

        RAW_STORAGE.append({"raw":raw,"ica": ica,"task": "set Annotations"})

        return {"message": "Annotations applied and saved successfully"}
    except Exception as e:
        print(e)
        return JSONResponse(content={"error": str(e)}, status_code=500)
    

@app.post("/upload-fif")
async def upload_fif(file: UploadFile):
    filename = "temp_" + file.filename
    contents = await file.read()

    with open(filename, "wb") as f:
        f.write(contents)

    try:
        raw = mne.io.read_raw_fif(filename, preload=True, verbose=False)
        data, times = raw[:8, :]  # extract first 8 channels
        return {
            "channels": raw.info["ch_names"][:8],
            "times": times.tolist(),
            "values": data.tolist(),
            "sampling_rate": raw.info["sfreq"]
        }
    finally:
        os.remove(filename)  # ✅ Clean up temp file



@app.post("/crop")
def crop_video_and_eeg(req: CropRequest):
    # ✅ 1. Crop video using ffmpeg
    video_output = "cropped_video.mp4"
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", VIDEO_FILE,
        "-ss", str(req.videoStart),
        "-to", str(req.videoEnd),
        "-c", "copy",
        video_output
    ]
    try:
        subprocess.run(ffmpeg_cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail="FFmpeg video crop failed")

    # ✅ 2. Crop EEG using MNE
    eeg_output = "cropped_eeg.fif"
    try:
        raw = mne.io.read_raw_fif(EEG_FILE, preload=True)
        raw.crop(tmin=req.eegStart, tmax=req.eegEnd)
        raw.save(eeg_output, overwrite=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MNE EEG crop failed: {e}")

    return {
        "status": "success",
        "video_path": video_output,
        "eeg_path": eeg_output
    }


def get_ist_meas_date(meas_date):
    """Extract measurement date from MNE fif file and return it in IST timezone."""
    if meas_date is None:
        raise ValueError("meas_date is None — no measurement date found.")
    
    if isinstance(meas_date, tuple):
        if isinstance(meas_date[0], datetime):
            dt = meas_date[0]
        else:
            dt = datetime.utcfromtimestamp(meas_date[0])
    elif isinstance(meas_date, datetime):
        dt = meas_date
    else:
        raise TypeError("Unsupported meas_date format.")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)  # assume UTC
    
    ist = timezone('Asia/Kolkata')
    return dt.astimezone(ist)


@app.post("/bulk-upload-fif")
async def upload_multiple_fif(files: list[UploadFile] = File(...)):
    global RAW_STORAGE
    RAW_STORAGE = []
    results = []

    save_dir = get_app_dir("Brasig/Uploaded_Files")  # Optional subfolder for better organization
    os.makedirs(save_dir, exist_ok=True)
    channel_list = None
    for idx, file in enumerate(files):
        try:
            filename = file.filename
            save_path = os.path.join(save_dir, filename)

            with open(save_path, "wb") as out_file:
                shutil.copyfileobj(file.file, out_file)

            raw = mne.io.read_raw_fif(save_path, preload=False)

            if raw.info.get('dig'):
                ist_time = get_ist_meas_date(raw.info.get('meas_date'))
                sfreq = raw.info['sfreq']
                n_samples = int(raw.n_times)
                n_channels = len(raw.info['ch_names'])
                duration = int(n_samples / sfreq)
                uid = uuid.uuid4()
                RAW_STORAGE.append({"uid":uid,"raw":raw})

                results.append({
                    "uid": uid,
                    "filename": file.filename,
                    "sampling_freq": sfreq,
                    "no_of_samples": n_samples,
                    "no_of_channels": n_channels,
                    "channel_type": "EEG",
                    "timestamp": ist_time.strftime('%Y-%m-%d %H:%M:%S %Z'),
                    "unix_start_time": int(ist_time.timestamp()),
                    "unix_end_time": int(ist_time.timestamp()) + duration,
                    "duration": duration,
                    "channel_list": raw.info['ch_names'],
                    "valid": True
                })
                channel_list = raw.info['ch_names']
            else:
                results.append({
                    "filename": file.filename,
                    "valid": False
                })
        except Exception as e:
            print(f"❌ Failed to process {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "valid": False,
                "error": str(e)
            })

    return {"results":results, "emotiv_eeg_channels":channel_list}

def get_app_dir(app_name="Brasig"):
    if sys.platform.startswith('win'):
        base_dir = os.path.join(os.getenv('APPDATA'), app_name)
    elif sys.platform.startswith('darwin'):
        base_dir = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', app_name)
    else:
        base_dir = os.path.join(os.path.expanduser('~'), '.config', app_name) # Or ~/.local/share
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

# def save_pipeline(data):
#     app_dir = get_app_dir("Brasig/Pipelines")
#     file_path = os.path.join(app_dir, f"pipeline_{int(data['created_unix_time'])}.json")
#     try:
#         with open(file_path, 'w') as f:
#             json.dump(data, f, indent=4)
#         return True
#     except IOError as e:
#         return False
    
# @app.post("/create-pipeline")
# async def create_pipeline(pipeline:dict):
#     pipeline['created_date'] = str(datetime.now())
#     pipeline['created_unix_time'] = time.time()
#     return save_pipeline(pipeline)


def save_pipeline(data):
    app_dir = get_app_dir("Brasig/Pipelines")
    file_path = os.path.join(app_dir, f"pipeline_{int(data['created_unix_time'])}.json")
    try:
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=4)
        return file_path
    except IOError:
        return None

@app.post("/create-pipeline")
async def create_pipeline(pipeline: dict):
    if "created_unix_time" not in pipeline:
        pipeline['created_unix_time'] = time.time()
    pipeline['created_date'] = str(datetime.now())
    path = save_pipeline(pipeline)
    if path:
        return {
            "success": True,
            "filename": os.path.basename(path),
            "created_unix_time": pipeline['created_unix_time']
        }
    else:
        return {
            "success": False,
            "error": "Could not save pipeline"
        }
    

@app.delete("/delete-pipeline")
def delete_pipeline(created_unix_time: float = Query(...)):
    app_dir = get_app_dir("Brasig/Pipelines")
    file_path = os.path.join(app_dir, f"pipeline_{int(created_unix_time)}.json")
    try:
        os.remove(file_path)
        return {"success": True}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


def epoch_equally(rawf, epoch_duration, calculation_method,reject_by_annotation,relative_power):
    event_id = 1
    events = mne.make_fixed_length_events(rawf, id=event_id, duration=epoch_duration)
    tmin = 0
    tmax = epoch_duration
    epochs_8 = mne.Epochs(rawf, events, event_id=event_id, tmin=tmin, tmax=tmax, reject_by_annotation= reject_by_annotation, baseline=None, preload=True)
    return epochs_8

def concatenate_epochs_into_channels(epochs, channel_list: list[str]):
    epochs_data = epochs.get_data()  # Shape: (n_epochs, n_channels, n_times)
    n_epochs, n_channels, n_samples = epochs_data.shape
    eeg_channels_data = {}

    for ch_idx in range(n_channels):
        concatenated = np.concatenate(epochs_data[:, ch_idx, :], axis=0)
        eeg_channels_data[channel_list[ch_idx]] = concatenated

    sketch_signal_length = len(next(iter(eeg_channels_data.values()))) / 256
    return eeg_channels_data, sketch_signal_length

# def channelwise_abp(eeg_channels_data_dictionary,bands, channel_list):
#     sf = 256
#     all_abp_set = []

#     for channel in channel_list:
#         signal = eeg_channels_data_dictionary[channel]
#         abp_set = []
#         for band_name, band_range in bands.items():
#             abp, _ = bandpower(signal, sf, band_range, method='multitaper', window_sec=None, relative=False)
#             abp_set.append(abp)
#         all_abp_set.append(abp_set)


#     # all_abp_set = np.array(all_abp_set)
#     return all_abp_set

def channelwise_abp(eeg_channels_data_dictionary, bands, channel_list):
    sf = 256
    all_abp_set = []

    for channel in channel_list:
        signal = eeg_channels_data_dictionary[channel]

        # ✅ Convert from V to μV
        signal = signal * 1e6

        abp_set = []
        for band_name, band_range in bands.items():
            abp, _ = bandpower(signal, sf, band_range, method='multitaper', window_sec=None, relative=False)
            abp_set.append(abp)
        all_abp_set.append(abp_set)

    return all_abp_set


def bandpower(data, sf, band, method='welch', window_sec=None, relative=False):
    band = np.asarray(band)
    low, high = band

    if method == 'welch':
        if window_sec is not None:
            nperseg = window_sec * sf
        else:
            nperseg = (2 / low) * sf

        freqs, psd = welch(data, sf, nperseg=nperseg)

    elif method == 'multitaper':
        psd, freqs = psd_array_multitaper(data, sf, adaptive=True, normalization='full', n_jobs=1, remove_dc= True, max_iter = 1024, verbose=0)

    freq_res = freqs[1] - freqs[0]

    idx_band = np.logical_and(freqs >= low, freqs <= high)

    bp = simpson(psd[idx_band], dx=freq_res)

    if relative:
        bp /= simpson(psd, dx=freq_res)
    return bp, freq_res


def calculate_time_domain_features(signal: np.ndarray) -> dict:
    N = len(signal)
    signal = np.asarray(signal)

    # ✅ Convert from volts to microvolts
    signal = signal * 1e6  # V → μV

    mean_val = np.mean(signal)
    median_val = np.median(signal)
    var_val = np.var(signal)
    std_val = np.std(signal)
    skew_val = skew(signal)
    kurtosis_val = kurtosis(signal)
    zcr_val = np.count_nonzero(np.diff(np.sign(signal))) / N
    energy_val = np.sum(signal ** 2) / N

    first_deriv = np.diff(signal)
    second_deriv = np.diff(first_deriv)

    activity = var_val
    mobility = np.sqrt(np.var(first_deriv) / activity) if activity != 0 else 0
    complexity = (
        np.sqrt(np.var(second_deriv) / np.var(first_deriv)) / mobility
        if mobility != 0 and np.var(first_deriv) != 0
        else 0
    )

    return {
        "mean": mean_val,                     # μV
        "median": median_val,                 # μV
        "variance": var_val,                  # μV²
        "std_dev": std_val,                   # μV
        "skewness": skew_val,
        "kurtosis": kurtosis_val,
        "zcr": zcr_val,
        "energy": energy_val,                 # μV²
        "hjorth_activity": activity,          # μV²
        "hjorth_mobility": mobility,
        "hjorth_complexity": complexity,
    }


@app.post("/select-fif-channel")
async def select_fif_channel(data: ChannelRequest):
    global RAW_STORAGE
    if not RAW_STORAGE:
        return JSONResponse(content={"error": "No EDF file uploaded"}, status_code=400)   
    
    for i,_ in enumerate(RAW_STORAGE):
        raw = RAW_STORAGE[i].get("raw").copy()   
        raw.load_data()
        raw.pick(data.selected_ch)
        full_montage = mne.channels.make_standard_montage(data.montage)
        positions = full_montage.get_positions()["ch_pos"]
        selected_positions = {ch: pos for ch, pos in positions.items() if ch in data.selected_ch}
        if len(selected_positions)==len(data.selected_ch):
            custom_montage = mne.channels.make_dig_montage(ch_pos=selected_positions, coord_frame='head')
            raw.set_montage(custom_montage)
        RAW_STORAGE[i]["raw"]=raw

@app.post("/extract-features")
async def extract_features(pipeline: dict, files_idx: list[str], channel_list: list[str]):
    global RAW_STORAGE
    pipeline = copy.deepcopy(pipeline)
    features = {}
    response = {}

    for fif in RAW_STORAGE:
        if str(fif['uid']) in files_idx:
            uid = fif['uid']
            fif_temp = fif['raw'].copy()

            # Convert to seconds if in milliseconds
            if pipeline['basic_details']['baseline_units'] == "millseconds":
                if pipeline['basic_details']['baseline_period_start'] != 0:
                    pipeline['basic_details']['baseline_period_start'] /= 1000.0
                pipeline['basic_details']['baseline_period_end'] /= 1000.0

            # Baseline and Sketching crop
            features['baseline'] = fif_temp.copy().crop(
                tmin=pipeline['basic_details']['baseline_period_start'],
                tmax=pipeline['basic_details']['baseline_period_end']
            )
            end_time = fif_temp.times[-1]
            features['sketching'] = fif_temp.copy().crop(
                tmin=pipeline['basic_details']['baseline_period_end'],
                tmax=end_time
            )

            # Initialize response for UID
            if uid not in response:
                response[uid] = {}

            for feature in ['baseline', 'sketching']:
                epochs = epoch_equally(
                    features[feature],
                    pipeline['frequency_domain_features']['band_power_estimation']['epochs_per_duration'],
                    pipeline['frequency_domain_features']['band_power_estimation']['calculation_method'],
                    pipeline['frequency_domain_features']['band_power_estimation']['reject_by_annoatation'],
                    pipeline['frequency_domain_features']['band_power_estimation']['relative_power']
                )

                channelwise_data, _ = concatenate_epochs_into_channels(epochs, channel_list)

                # Extract band definitions
                bands = {
                    band: [data['lower'], data['upper']]
                    for band, data in pipeline['frequency_domain_features']['frequency_bands'].items()
                }   

                abp_list = channelwise_abp(channelwise_data, bands, channel_list)
                band_names = list(pipeline['frequency_domain_features']['frequency_bands'].keys())
                # Init nested response
                if feature not in response[uid]:
                    response[uid][feature] = {}

                for idx, ch in enumerate(channel_list):
                    if ch not in response[uid][feature]:
                        response[uid][feature][ch] = {}

                    response[uid][feature][ch]["band_power"] = [[band_names[i],value] for i,value in enumerate(abp_list[idx])]
                    response[uid][feature][ch]["time_domain"] = calculate_time_domain_features(channelwise_data[ch])
    return response


@app.get("/get-files")
def get_files():
    return [f["raw"].filenames[0] for f in RAW_STORAGE if "raw" in f]

@app.get("/get-pipelines")
def get_pipelines():
    dir_path = get_app_dir("Brasig/Pipelines")
    all_files = glob.glob(os.path.join(dir_path, "*.json"))
    result = []
    for path in all_files:
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                result.append(data)
        except Exception as e:
            continue
    return result

@app.get("/get-psd-bar")
def get_psd_bar(file: str, channel: str):
    # Locate file
    for f in RAW_STORAGE:
        if file in f.get("raw").filenames[0]:
            raw = f["raw"].copy()
            raw.load_data()
            data = raw.get_data(picks=[channel])[0]
            sf = raw.info['sfreq']
            f_vals, pxx = welch(data, sf, nperseg=1024)

            # PSD plot
            fig1, ax1 = plt.subplots()
            ax1.plot(f_vals, 10 * np.log10(pxx))
            ax1.set_title(f'{channel} PSD Plot')
            ax1.set_xlabel('Frequency (Hz)')
            ax1.set_ylabel('Power (dB)')

            buf1 = io.BytesIO()
            fig1.savefig(buf1, format='png')
            buf1.seek(0)
            psd_img = base64.b64encode(buf1.read()).decode('utf-8')
            plt.close(fig1)

            # Band Power Bar plot
            bands = {"delta": (0, 4), "theta": (4, 8), "alpha": (8, 12), "beta": (12, 33)}
            bar_vals = [bandpower(data, sf, b)[0] for b in bands.values()]
            fig2, ax2 = plt.subplots()
            ax2.bar(bands.keys(), bar_vals)
            ax2.set_title(f'{channel} Average Band Power')
            buf2 = io.BytesIO()
            fig2.savefig(buf2, format='png')
            buf2.seek(0)
            bar_img = base64.b64encode(buf2.read()).decode('utf-8')
            plt.close(fig2)

            return {"psd": psd_img, "bar": bar_img}
    raise HTTPException(status_code=404, detail="File not found")


@app.get("/get-file-info")
def get_file_info(file: str):
    filename_only = os.path.basename(file)
    for f in RAW_STORAGE:
        raw = f.get("raw")
        if raw and raw.filenames:
            raw_filename = os.path.basename(raw.filenames[0])
            if filename_only == raw_filename:
                return {
                    "sampling_frequency": raw.info["sfreq"],
                    "samples": raw.n_times,
                    "channels": raw.info["nchan"],
                    "type": "EEG"
                }
    raise HTTPException(status_code=404, detail="File not found")