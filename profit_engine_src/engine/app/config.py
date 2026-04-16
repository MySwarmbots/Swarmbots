from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    mode: str = Field(default="paper", alias="MODE")
    webhook_secret: str = Field(default="change-me", alias="WEBHOOK_SECRET")
    base_confidence_threshold: float = Field(default=0.68, alias="BASE_CONFIDENCE_THRESHOLD")
    top_signal_count: int = Field(default=10, alias="TOP_SIGNAL_COUNT")
    max_position_notional_usd: float = Field(default=500.0, alias="MAX_POSITION_NOTIONAL_USD")
    max_daily_loss_usd: float = Field(default=250.0, alias="MAX_DAILY_LOSS_USD")
    kill_switch: str = Field(default="OFF", alias="KILL_SWITCH")
    cooldown_bars: int = Field(default=2, alias="COOLDOWN_BARS")

settings = Settings()
