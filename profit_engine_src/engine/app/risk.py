from app.config import settings
from app.state import realized_pnl_usd, cooldowns

def check_risk(symbol, notional_usd):
    if settings.kill_switch.upper() == "ON":
        return False, "kill_switch"
    if realized_pnl_usd <= -abs(settings.max_daily_loss_usd):
        return False, "max_daily_loss"
    if notional_usd > settings.max_position_notional_usd:
        return False, "max_position_notional"
    if cooldowns.get(symbol, 0) > 0:
        return False, "cooldown_active"
    return True, "ok"
