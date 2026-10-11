import gzip
import numpy as np
import io


# data = np.load("raw_data.npz")
# print(data.files)
# print("📊 EEG Data:", data["data"])
# print("🕒 Times:", data["times"])
# print("📡 Channels:", data["channels"])




# Step 1: Open the Gzip compressed NPZ file
with gzip.open("test_compressed.npz.gz", "rb") as gz_file:
    decompressed_data = gz_file.read()

# Step 2: Convert to BytesIO to load with NumPy
npz_file = io.BytesIO(decompressed_data)
np_data = np.load(npz_file)

# Step 3: Print the keys to check if it's loaded correctly
print("📂 NPZ Keys:", np_data.files)

# Step 4: Access and print each dataset
print("📊 EEG Data:", np_data["data"])
print("🕒 Times:", np_data["times"])
print("📡 Channels:", np_data["channels"])

if 'channels' in np_data:
    print("✅ 'channels.npy' exists in NPZ file!")
    print("📡 Channels Data:", np_data['channels'])
    print("📡 Channels Type:", type(np_data['channels']))
    print("Channels Dtype:", np_data["channels"].dtype)
else:
    print("❌ 'channels.npy' is missing from NPZ file!")

# with gzip.open("test_compressed.npz.gz", "rb") as f:
#     npz_data = np.load(f)
#     print(npz_data.files)  # Expected: ['data', 'times', 'channels']