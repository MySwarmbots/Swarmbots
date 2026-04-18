# MiroFish Operations Guide — How to Earn Money

## Your Profile: Intermediate | $25-$100 Capital | Semi-Automated

---

## PHASE 1: SETUP (10 minutes)

### Step 1: Fund Your Bitget Account
1. Log into [Bitget](https://www.bitget.com)
2. Go to **Assets → Deposit**
3. Deposit **$50 USDT** (recommended starting amount) via TRC-20 or your preferred network
4. Wait for confirmation (usually 2-5 minutes)
5. Verify in MiroFish: Go to **Exchange → Balance tab** — you should see your USDT balance

### Step 2: Verify Telegram is Connected
1. Open MiroFish → **Settings**
2. Confirm **TELEGRAM: CONNECTED** (green status)
3. If not connected: Enter Chat ID `8595510246` and click LINK
4. Click **TEST** — you should receive a test message from @TraderGMONYbot

### Step 3: Configure the Scheduler
1. Go to **Dungeon → Scheduled Predictions panel**
2. Verify it shows: **RUNNING**, 5 min interval, 6 symbols
3. You should already be receiving Telegram alerts every 5 minutes

---

## PHASE 2: OBSERVE & LEARN (1-3 days)

**DO NOT enable auto-trading yet.** First, learn the swarm's behavior.

### Step 4: Monitor Signal Strength
1. Go to **Signals** page daily
2. Watch these key metrics build up:
   - **Win Rate** — Target: above 50% means the swarm is profitable
   - **Accuracy by Symbol** — Identify which coins the swarm predicts best
   - **Accuracy by Direction** — Check if LONG or SHORT signals are more reliable
3. After 24 hours you'll have ~288 verified signals (6 symbols × 12 per hour × 24 hours)

### Step 5: Read Telegram Alerts
Every 5 minutes you'll receive alerts like:
```
🟢 Swarm Prediction: BTCUSDT
Direction: LONG
Confidence: 67.3%
Votes: 🟢7B 🔴3S 🟡2N
```
- **Pay attention to confidence > 60%** — these are the strongest signals
- **7+ votes in one direction** = high consensus = stronger signal
- Note which symbols consistently have high-confidence predictions

### Step 6: Understand the Dashboard
- **Control Room**: Overall system health, gate status, PnL
- **Space Dungeon**: 24 agents in 6 sectors — watch which rooms are most active
- **Engine**: Profit engine showing regime detection (trend/breakout/low_vol/high_vol)

### What to Track in Your Observation Period:
| Metric | Good | Caution | Stop |
|--------|------|---------|------|
| Win Rate | >52% | 45-52% | <45% |
| Avg PnL/Signal | >0% | -0.1 to 0% | < -0.1% |
| High-conf signals (>60%) | Frequent | Rare | Never |

---

## PHASE 3: SEMI-AUTOMATED TRADING (After observation)

### Step 7: Configure Auto-Execution (Conservative Settings)
1. Go to **Dungeon → Auto-Execution panel**
2. Click the **gear icon** to edit settings:
   - **Max Trade**: `$2.00` (start small — only risk 2-4% per trade)
   - **Min Confidence**: `0.65` (only trade on 65%+ confidence signals)
   - **Cooldown**: `600` seconds (10 minutes between trades — prevents overtrading)
   - **Symbols**: Focus on your best-performing coins from the Signals data
3. Click **SAVE**

### Step 8: Enable Auto-Execution
1. Toggle **AUTO-EXECUTION → ON**
2. You'll see the badge change from "OFF" to **"LIVE"**
3. The system will now auto-trade when the swarm has high-confidence consensus

### Step 9: Your Daily Semi-Automated Workflow
**Morning (5 min):**
1. Check **Signals page** → Win Rate trending up or down?
2. Check **Exchange → Balance** → Current USDT balance
3. Review overnight auto-trades in **Dungeon → Auto-Exec Trades**

**During the day:**
- Telegram alerts keep you informed — no need to stare at the screen
- When you see a high-confidence alert (>70%), you can also manually trade on **Exchange page**
- The auto-exec handles the rest

**Evening (5 min):**
1. Check **Signals page** → How many correct predictions today?
2. Review **Exchange → Order History** → See all executed trades
3. Adjust settings if needed (raise/lower confidence threshold)

---

## PHASE 4: OPTIMIZATION (After 1 week)

### Step 10: Tune Based on Real Data
After 1 week of semi-automated trading, review your Signals data:

**If Win Rate > 55%:**
- You're profitable — consider increasing Max Trade to `$3-5`
- Lower confidence threshold to `0.60` to catch more trades

**If Win Rate 50-55%:**
- Stay conservative — keep Max Trade at `$2`
- Focus only on the 2-3 best-performing symbols
- Raise confidence threshold to `0.70`

**If Win Rate < 50%:**
- Disable auto-exec temporarily
- Observe for another 2-3 days
- Check if specific symbols are dragging down performance — remove them

### Step 11: Scale Up (When Confident)
Once you have 500+ verified signals with >53% win rate:
1. Increase Max Trade: `$5-10`
2. Add more symbols if they show good accuracy
3. Reduce cooldown to `300` seconds (5 min)
4. Consider reducing scheduler interval to `3` minutes for faster signals

---

## RISK MANAGEMENT RULES

### The 3 Rules (Never Break These):
1. **Never risk more than 5% of your balance per trade** — If balance is $50, max trade = $2.50
2. **Kill switch if daily loss > 10%** — Go to Engine → Kill Switch → ON
3. **Review signals weekly** — Markets change, swarm accuracy fluctuates

### Emergency Actions:
| Situation | Action |
|-----------|--------|
| 3 losses in a row | Increase cooldown to 900s (15 min) |
| Win rate drops below 45% | Disable auto-exec, observe only |
| Major market crash/pump | Kill switch ON, wait for volatility to calm |
| Bitget maintenance | Auto-exec will gracefully fail — no action needed |

### Where to Find Controls:
- **Kill Switch**: Engine page → Engine Config → Kill Switch toggle
- **Auto-Exec Toggle**: Dungeon page → Auto-Execution panel → ON/OFF switch
- **Scheduler Toggle**: Dungeon page → Scheduled Predictions → ON/OFF switch

---

## EARNINGS EXPECTATIONS (Realistic)

With $50 capital and semi-automated strategy:

| Scenario | Monthly Return | Monthly Earnings |
|----------|---------------|-----------------|
| Conservative (55% WR, $2 trades) | 5-10% | $2.50-$5.00 |
| Moderate (58% WR, $3 trades) | 10-20% | $5.00-$10.00 |
| Aggressive (60% WR, $5 trades) | 15-30% | $7.50-$15.00 |

**Important**: These are estimates. Crypto markets are volatile. Past swarm performance does not guarantee future results. Start small, scale based on verified data.

---

## QUICK REFERENCE: Key Pages

| Page | What It Does | Check Frequency |
|------|-------------|-----------------|
| **Dashboard** | System overview, live avatars, gate status | Daily |
| **Dungeon** | Swarm agents, predictions, auto-exec, scheduler | Daily |
| **Exchange** | Bitget balance, place manual trades, order history | Daily |
| **Signals** | Win rate, accuracy tracking, PnL history | Daily |
| **Engine** | Profit engine config, regime detection, kill switch | Weekly |
| **Charts** | Performance charts, portfolio breakdown | Weekly |
| **Settings** | Telegram link, notification preferences | Once |

---

## GETTING STARTED CHECKLIST

- [ ] Deposit $50 USDT to Bitget
- [ ] Verify Telegram connected (Settings page)
- [ ] Confirm scheduler running (Dungeon → Scheduled Predictions → RUNNING)
- [ ] Observe signals for 1-3 days (Signals page)
- [ ] Set auto-exec: Max $2, Confidence 0.65, Cooldown 600s
- [ ] Enable auto-execution (Dungeon → toggle ON)
- [ ] Check Signals page daily for win rate
- [ ] After 1 week: adjust based on data
- [ ] Scale up gradually as confidence grows
