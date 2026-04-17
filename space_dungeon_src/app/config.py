from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    mode: str = Field(default="paper", alias="MODE")
    database_url: str = Field(default="data/mirofish.db", alias="DATABASE_URL")
    rollout_stage: str = Field(default="shadow", alias="ROLLOUT_STAGE")
    canary_capital_usd: float = Field(default=100.0, alias="CANARY_CAPITAL_USD")
    phase1_capital_usd: float = Field(default=300.0, alias="PHASE1_CAPITAL_USD")
    phase2_capital_usd: float = Field(default=750.0, alias="PHASE2_CAPITAL_USD")
    full_capital_usd: float = Field(default=1500.0, alias="FULL_CAPITAL_USD")
    auto_disable_on_anomaly: bool = Field(default=True, alias="AUTO_DISABLE_ON_ANOMALY")
    max_failed_validations: int = Field(default=3, alias="MAX_FAILED_VALIDATIONS")
    min_passed_validations_to_promote: int = Field(default=5, alias="MIN_PASSED_VALIDATIONS_TO_PROMOTE")
    swarm_agent_count: int = Field(default=24, alias="SWARM_AGENT_COUNT")

settings = Settings()
