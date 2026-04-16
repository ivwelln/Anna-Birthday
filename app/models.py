from __future__ import annotations

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def generate_id() -> str:
    return uuid4().hex


class TextBlock(BaseModel):
    id: str = Field(default_factory=generate_id)
    content: str = Field(default="Новый текст", max_length=500)
    color: str = Field(default="#ffffff", pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")
    font_size: int = Field(default=34, ge=16, le=96)
    align: Literal["left", "center", "right"] = "center"
    delay_seconds: float = Field(default=0, ge=0, le=10)


class ImageBlock(BaseModel):
    id: str = Field(default_factory=generate_id)
    src: str = Field(min_length=1)
    alt: str = Field(default="", max_length=200)
    width_percent: int = Field(default=28, ge=12, le=100)
    max_height: int = Field(default=220, ge=80, le=420)


class Slide(BaseModel):
    id: str = Field(default_factory=generate_id)
    button_text: str = Field(default="Продолжить", max_length=60)
    continue_delay_seconds: int = Field(default=2, ge=1, le=3)
    layout: Literal["text-top", "images-top", "text-left", "images-left"] = "text-top"
    text_gap: int = Field(default=12, ge=0, le=80)
    text_blocks: list[TextBlock] = Field(default_factory=list)
    image_blocks: list[ImageBlock] = Field(default_factory=list)


class SiteContent(BaseModel):
    slides: list[Slide] = Field(default_factory=list)
