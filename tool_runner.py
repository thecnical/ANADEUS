from __future__ import annotations

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent / "tool_runner"
if str(BASE_DIR) not in sys.path:
  sys.path.insert(0, str(BASE_DIR))

from main import main  # noqa: E402


if __name__ == "__main__":
  raise SystemExit(main())
