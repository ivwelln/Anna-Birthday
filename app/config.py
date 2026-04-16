from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AppSettings:
    base_dir: Path
    templates_dir: Path
    static_dir: Path
    uploads_dir: Path
    audio_dir: Path
    data_dir: Path
    data_file: Path

    @classmethod
    def from_base_dir(cls, base_dir: str | Path) -> "AppSettings":
        root = Path(base_dir).resolve()
        app_dir = root / "app"
        static_dir = app_dir / "static"
        data_dir = root / "data"
        return cls(
            base_dir=root,
            templates_dir=app_dir / "templates",
            static_dir=static_dir,
            uploads_dir=static_dir / "uploads",
            audio_dir=static_dir / "audio",
            data_dir=data_dir,
            data_file=data_dir / "site_content.json",
        )


DEFAULT_SETTINGS = AppSettings.from_base_dir(Path(__file__).resolve().parent.parent)
