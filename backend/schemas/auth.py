from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str
    role: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
