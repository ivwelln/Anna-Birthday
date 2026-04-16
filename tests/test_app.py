from pathlib import Path

from fastapi.testclient import TestClient

from app.config import AppSettings
from app.main import create_app


def build_settings(tmp_path: Path) -> AppSettings:
    project_root = Path(__file__).resolve().parents[1]
    static_dir = tmp_path / "static"
    uploads_dir = static_dir / "uploads"
    audio_dir = static_dir / "audio"
    data_dir = tmp_path / "data"
    return AppSettings(
        base_dir=project_root,
        templates_dir=project_root / "app" / "templates",
        static_dir=static_dir,
        uploads_dir=uploads_dir,
        audio_dir=audio_dir,
        data_dir=data_dir,
        data_file=data_dir / "site_content.json",
    )


def test_index_and_admin_pages_render(tmp_path: Path) -> None:
    app = create_app(build_settings(tmp_path))
    client = TestClient(app)

    home_response = client.get("/")
    admin_response = client.get("/admin")

    assert home_response.status_code == 200
    assert admin_response.status_code == 200
    assert "birthdayApp" in home_response.text
    assert "adminApp" in admin_response.text


def test_content_roundtrip(tmp_path: Path) -> None:
    app = create_app(build_settings(tmp_path))
    client = TestClient(app)

    payload = {
        "slides": [
            {
                "id": "slide1",
                "button_text": "Дальше",
                "continue_delay_seconds": 3,
                "layout": "text-top",
                "text_gap": 24,
                "text_blocks": [
                    {
                        "id": "text1",
                        "content": "С днем рождения",
                        "color": "#ffffff",
                        "font_size": 36,
                        "align": "center",
                    }
                ],
                "image_blocks": [],
            }
        ]
    }

    save_response = client.put("/api/content", json=payload)
    get_response = client.get("/api/content")

    assert save_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.json()["slides"][0]["button_text"] == "Дальше"
    assert get_response.json()["slides"][0]["continue_delay_seconds"] == 3
    assert get_response.json()["slides"][0]["text_gap"] == 24
