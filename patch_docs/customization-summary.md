# Gemini Customization for Self-Hosted Firecrawl

## Executive Summary

We customized our self-hosted Firecrawl deployment to use **Google Gemini models** instead of OpenAI, with full visibility into LLM costs. This enables:

- **Cost control**: Pay-as-you-go with your own Google AI Studio API key
- **Cost transparency**: See exactly what each extraction costs, broken down by operation
- **Flexibility**: Choose different Gemini models for different tasks based on cost/performance needs

---

## What We Changed

### 1. Per-Task Model Configuration

**Before:** All LLM tasks used hardcoded OpenAI models (gpt-4o-mini, gpt-4.1).

**After:** Each LLM task can be configured independently via environment variables.

| Task | What It Does | Our Choice |
|------|--------------|------------|
| **Extraction** | Pulls structured data from pages | gemini-2.0-flash |
| **Extraction Fallback** | Retries with a smarter model | gemini-2.5-pro |
| **Schema Analysis** | Decides single-answer vs multi-entity | gemini-2.5-flash |
| **URL Reranking** | Scores which pages are most relevant | gemini-2.5-flash |
| **Schema Generation** | Creates JSON schema from prompt | gemini-2.0-flash |

**Why it matters:** We can optimize cost vs quality per task. Fast/cheap models for simple tasks, powerful models only when needed.

---

### 2. Accurate Cost Tracking

**Before:** Cost tracking was broken for non-OpenAI models (showed $0 or wildly wrong values).

**After:** Every LLM call is tracked with:
- Input/output token counts
- Model used
- Calculated cost in dollars
- Which operation made the call

**Example output (verbosity="detailed"):**
```json
{
  "costTracking": {
    "totalCalls": 2,
    "totalInputTokens": 15714,
    "totalOutputTokens": 153,
    "totalCost": 0.001994,
    "calls": [
      { "model": "gemini-2.0-flash", "tokens": {"input": 15377, "output": 13}, "cost": 0.001543 },
      { "model": "gemini-2.5-flash", "tokens": {"input": 337, "output": 140}, "cost": 0.000451 }
    ]
  }
}
```

**Why it matters:** We can now budget and forecast LLM costs accurately. No surprises on the Google Cloud bill.

---

### 3. Python SDK Integration

**Before:** Python SDK couldn't access cost tracking data.

**After:** New parameters and response fields in the SDK:

```python
from firecrawl import FirecrawlApp

app = FirecrawlApp(api_key="fc-test", api_url="http://localhost:3002")

# For self-hosted, use app.v1.extract() to call /v1/extract
result = app.v1.extract(
    urls=["https://example.com/*"],
    prompt="Extract company info",
    show_cost_tracking=True,                    # Enable detailed breakdown
    cost_tracking_verbosity="detailed",         # "summary", "detailed", or "full"
)

# v1 API returns camelCase fields
print(f"Total cost: ${result.costTracking.totalCost}")
print(f"Total calls: {result.costTracking.totalCalls}")
print(f"Input tokens: {result.costTracking.totalInputTokens}")
print(f"Output tokens: {result.costTracking.totalOutputTokens}")
```

**Why it matters:** Our Python applications can programmatically track and report on extraction costs.

> **Note:** `show_llm_usage` is deprecated. Use `show_cost_tracking=True` and access `result.costTracking.totalCost` instead.
>
> **Important:** `app.extract()` uses v2 API by default (requires Supabase). For self-hosted, use `app.v1.extract()` which calls the v1 API.

---

## Cost Structure

### Gemini Model Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best For |
|-------|----------------------|------------------------|----------|
| gemini-2.0-flash | $0.10 | $0.40 | High-volume, simple tasks |
| gemini-2.5-flash | $0.30 | $2.50 | Balanced cost/quality |
| gemini-2.5-pro | $1.25 | $10.00 | Complex reasoning |

### Typical Extraction Costs

| Scenario | Pages | Estimated Cost |
|----------|-------|----------------|
| Simple single page | 1 | ~$0.0003 |
| Small batch (3-5 pages) | 5 | ~$0.002-0.004 |
| Medium batch (10 pages) | 10 | ~$0.006-0.010 |

**Comparison:** Roughly 50-80% cheaper than equivalent OpenAI models for most extraction tasks.

---

## How to Use

### Configuration (.env)

```bash
# Google AI Studio API Key
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...

# Model assignments (all optional - defaults to OpenAI)
EXTRACT_MODEL=gemini-2.0-flash
EXTRACT_MODEL_PROVIDER=google
EXTRACT_FALLBACK_MODEL=gemini-2.5-pro
EXTRACT_FALLBACK_MODEL_PROVIDER=google
# ... etc for other tasks
```

### API Request

```bash
curl -X POST http://localhost:3002/v1/extract \
  -H "Authorization: Bearer fc-test" \
  -d '{
    "urls": ["https://example.com/*"],
    "prompt": "Extract company name and services",
    "limit": 5,
    "__experimental_showCostTracking": true,
    "__experimental_costTrackingVerbosity": "detailed"
  }'
```

### Python

```python
from firecrawl import FirecrawlApp

app = FirecrawlApp(api_key="fc-test", api_url="http://localhost:3002")

# Use app.v1.extract() for self-hosted (calls /v1/extract)
result = app.v1.extract(
    urls=["https://example.com/*"],
    prompt="Extract company info",
    limit=5,
    show_cost_tracking=True,
    cost_tracking_verbosity="detailed",  # "summary", "detailed", or "full"
)

# v1 returns camelCase: result.costTracking.totalCost
```

---

## Key Benefits

| Benefit | Description |
|---------|-------------|
| **Cost Reduction** | Gemini models are generally cheaper than OpenAI equivalents |
| **Cost Visibility** | See exactly what each extraction costs |
| **Flexibility** | Mix models based on task requirements |
| **No Vendor Lock-in** | Can switch back to OpenAI or add other providers |
| **Self-Hosted Control** | Your API keys, your data, your costs |

---

## Limitations

1. **Fire-1 Agent Mode**: SmartScrape (browser automation) still requires Firecrawl cloud API - not affected by these changes

2. **Model Availability**: Some Gemini models may not be available in all regions or API tiers

3. **Token Counting**: We use actual API-reported token counts (not estimates), which is accurate but means costs are calculated after the call
