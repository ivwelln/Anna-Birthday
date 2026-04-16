from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import DEFAULT_SETTINGS, AppSettings
from .models import ImageBlock, SiteContent
from .storage import ContentStore


def create_app(settings: AppSettings | None = None) -> FastAPI:
    app_settings = settings or DEFAULT_SETTINGS
    store = ContentStore(app_settings)
    store.ensure_paths()

    app = FastAPI(title="Birthday Slides", version="1.0.0")
    app.state.settings = app_settings
    app.state.store = store
    app.mount("/static", StaticFiles(directory=app_settings.static_dir), name="static")

    templates = Jinja2Templates(directory=str(app_settings.templates_dir))

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(
            request=request,
            name="index.html",
            context={
                "request": request,
                "audio_url": store.get_audio_track_url(),
            },
        )

    @app.get("/admin", response_class=HTMLResponse)
    async def admin(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(
            request=request,
            name="admin.html",
            context={
                "request": request,
                "audio_dir_hint": str(Path("app/static/audio")),
            },
        )

    @app.get("/api/content", response_model=SiteContent)
    async def get_content() -> SiteContent:
        return store.load()

    @app.put("/api/content", response_model=SiteContent)
    async def save_content(content: SiteContent) -> SiteContent:
        return store.save(content)

    @app.post("/api/uploads/images")
    async def upload_images(files: list[UploadFile] = File(...)) -> dict[str, list[ImageBlock]]:
        uploaded: list[ImageBlock] = []
        for file in files:
            try:
                src = store.store_uploaded_image(file.filename or "image.jpg", file.file)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            uploaded.append(
                ImageBlock(
                    src=src,
                    alt=Path(file.filename or "").stem,
                )
            )
        return {"items": uploaded}

    return app


app = create_app()
