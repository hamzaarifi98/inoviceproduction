from pathlib import Path
import os

# Project root (assumes this file is at backend/app/core/config.py)
# parents: 0=core,1=app,2=backend,3=InvoiceAPP workspace root
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# DATA_DIR can be set via the environment variable `DATA_DIR`.
# Defaults to the repository-level `data/` directory.
DATA_DIR = Path(os.getenv("DATA_DIR", PROJECT_ROOT / "data/uploaded"))


