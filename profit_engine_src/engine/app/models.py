from typing import Literal, Optional
from pydantic import BaseModel, Field

Action = Literal["buy", "sell", "hold"]

class TradingViewWebhook(BaseModel):
    secret: str
    ticker: str
    action: Action
    price: float
    interval: str = "5m"
    time: str
    id: Optional[str] = None
    position_size: float = 100.0

class SignalSnapshot(BaseModel):
    symbol: str
    timeframe: str = "5m"
    price: float
    ema_fast: float
    ema_slow: float
    rsi: float
    vwap: float
    channel_upper: float
    channel_lower: float
    atr_pct: float = 0.01
    higher_tf_bias: Action = "hold"
    timestamp: Optional[str] = None

class DetectorSignal(BaseModel):
    detector: str
    action: Action
    score: float = Field(ge=0, le=1)
    reason: str

class CorePrediction(BaseModel):
    symbol: str
    timeframe: str
    selected_action: Action
    confidence: float = Field(ge=0, le=1)
    disagreement: float = Field(ge=0, le=1)
    regime: str
    threshold_used: float = Field(ge=0, le=1)
    position_multiplier: float
    top_signals: list[DetectorSignal]
