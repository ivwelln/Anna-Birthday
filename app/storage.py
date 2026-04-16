from __future__ import annotations

import json
import shutil
from pathlib import Path
from threading import Lock
from uuid import uuid4

from .config import AppSettings
from .models import SiteContent

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".m4a", ".aac"}


class ContentStore:
    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings
        self._lock = Lock()

    def ensure_paths(self) -> None:
        if not self.settings.templates_dir.exists():
            self.settings.templates_dir.mkdir(parents=True, exist_ok=True)
        self.settings.static_dir.mkdir(parents=True, exist_ok=True)
        self.settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.settings.audio_dir.mkdir(parents=True, exist_ok=True)
        self.settings.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.settings.data_file.exists():
            payload = SiteContent().model_dump(mode="json")
            self.settings.data_file.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    def load(self) -> SiteContent:
        self.ensure_paths()
        with self._lock:
            payload = json.loads(self.settings.data_file.read_text(encoding="utf-8"))
        return SiteContent.model_validate(payload)

    def save(self, content: SiteContent) -> SiteContent:
        self.ensure_paths()
        payload = content.model_dump(mode="json")
        with self._lock:
            self.settings.data_file.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        return content

    def store_uploaded_image(self, file_name: str, temp_file) -> str:
        suffix = Path(file_name).suffix.lower()
        if suffix not in ALLOWED_IMAGE_EXTENSIONS:
            raise ValueError("Unsupported image type")
        safe_name = f"{uuid4().hex}{suffix}"
        target = self.settings.uploads_dir / safe_name
        with target.open("wb") as buffer:
            shutil.copyfileobj(temp_file, buffer)
        return f"/static/uploads/{safe_name}"

    def get_audio_track_url(self) -> str | None:
        self.ensure_paths()
        audio_files = sorted(
            path
            for path in self.settings.audio_dir.iterdir()
            if path.is_file() and path.suffix.lower() in ALLOWED_AUDIO_EXTENSIONS
        )
        if not audio_files:
            return None
        return f"/static/audio/{audio_files[0].name}"
