from datetime import datetime
from pydantic import BaseModel, field_validator
import json


class IPGroupCreate(BaseModel):
    name: str
    ips: list[str] = []


class IPGroupUpdate(BaseModel):
    name: str | None = None
    ips: list[str] | None = None


class IPGroupOut(BaseModel):
    id: int
    name: str
    ips: list[str] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("ips", mode="before")
    @classmethod
    def normalize_ips(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
            except Exception:
                return [v]
            return parsed if isinstance(parsed, list) else [v]
        return v
