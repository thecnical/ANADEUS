from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_FILE = LOG_DIR / "tool_runner.log"
LOGGER_NAME = "anadeus.tool_runner"


def get_logger() -> logging.Logger:
  LOG_DIR.mkdir(parents=True, exist_ok=True)
  logger = logging.getLogger(LOGGER_NAME)

  if logger.handlers:
    return logger

  logger.setLevel(logging.INFO)
  handler = RotatingFileHandler(LOG_FILE, maxBytes=1_048_576, backupCount=3, encoding="utf-8")
  formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
  handler.setFormatter(formatter)
  logger.addHandler(handler)
  logger.propagate = False
  return logger
