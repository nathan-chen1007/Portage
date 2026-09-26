import sys
from pathlib import Path

# Let tests import the `app` package when run from backend/ with `python -m pytest`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
