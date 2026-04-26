from datetime import datetime
from pydantic import BaseModel


class IPGroupCreate(BaseModel):
    name: str
    ips: list[str] = []


class IPGroupUpdate(BaseModel):
    name: str | None = None
    ips: list[str] | None = None


class IPGroupOut(BaseModel):
    id: int
    name: str
    ips: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
