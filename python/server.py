# import time
# import uvicorn
# import os
# import sys
# from pathlib import Path
# from main import app

# # Redirect logs to a file instead of the console
# desktop = Path.home() / "Desktop"
# log_file = desktop / "server.log"
# sys.stdout = open(log_file, "w")
# sys.stderr = open(log_file, "w")

# if __name__ == "__main__":
#     try:
#         uvicorn.run(app, host="127.0.0.1", port=8000)
#     except Exception as e:
#         print(f"Error: {e}")
#         time.sleep(10)


import multiprocessing
import os
import sys
import uvicorn
from main import app
from pathlib import Path

# Redirect logs to a file instead of the console
desktop = Path.home() / "Desktop"
log_file = desktop / "server.log"
sys.stdout = open(log_file, "a")
sys.stderr = open(log_file, "a")

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000)

if __name__ == "__main__":
    multiprocessing.freeze_support()  # Required for PyInstaller
    server_process = multiprocessing.Process(target=run_server)
    server_process.start()
    
    # Keep the process alive (Prevents instant exit)
    server_process.join()
