# hook-mne.py
from PyInstaller.utils.hooks import collect_data_files

# This collects .pyi and other necessary data files
datas = collect_data_files("mne", include_py_files=True)
