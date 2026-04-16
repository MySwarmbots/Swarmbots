from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    mode: str = Field(default="paper", alias="MODE")
    database_url: str = Field(default="data/mirofish.db", alias="DATABASE_URL")
    webhook_secret: str = Field(default="change-me", alias="WEBHOOK_SECRET")
    default_exchange: str = Field(default="binance", alias="DEFAULT_EXCHANGE")
    kill_switch: str = Field(default="OFF", alias="KILL_SWITCH")
    max_allowed_slippage_bps: float = Field(default=15.0, alias="MAX_ALLOWED_SLIPPAGE_BPS")
    max_allowed_fee_bps: float = Field(default=12.0, alias="MAX_ALLOWED_FEE_BPS")
    max_recon_drift_pct: float = Field(default=1.0, alias="MAX_RECON_DRIFT_PCT")
    rollout_gate_mode: str = Field(default="shadow", alias="ROLLOUT_GATE_MODE")

settings = Settings()
