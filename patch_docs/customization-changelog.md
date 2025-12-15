# Changelog: Gemini Model Customization & Cost Tracking Fixes

## Overview

This document details all modifications made to enable per-task LLM model customization with Gemini models, along with critical bug fixes for accurate cost tracking in self-hosted Firecrawl deployments.

**Date:** December 12, 2025  
**Scope:** Self-hosted Firecrawl with Google AI Studio (Gemini) models

---

## Table of Contents

1. [Per-Task Model Configuration System](#1-per-task-model-configuration-system)
2. [Environment Variables Configuration](#2-environment-variables-configuration)
3. [Google AI Studio Compatibility Fix](#3-google-ai-studio-compatibility-fix)
4. [Token Usage Tracking Fix](#4-token-usage-tracking-fix)
5. [Comprehensive Fire-0 Cost Tracking](#5-comprehensive-fire-0-cost-tracking)
6. [Cost Calculation Bug Fix](#6-cost-calculation-bug-fix)
7. [Async Job Cost Tracking Visibility](#7-async-job-cost-tracking-visibility)
8. [Python SDK Cost Tracking Support](#8-python-sdk-cost-tracking-support)
9. [Cost Tracking Verbosity System](#9-cost-tracking-verbosity-system)
10. [SmartScrape Cleanup & Self-Hosted Simplification](#10-smartscrape-cleanup--self-hosted-simplification)
11. [v1 vs v2 API Compatibility](#11-v1-vs-v2-api-compatibility)
12. [Files Modified Summary](#12-files-modified-summary)
13. [Testing & Verification](#13-testing--verification)

---

## 1. Per-Task Model Configuration System

### Problem
Firecrawl had hardcoded model selections throughout the codebase, making it impossible to use alternative LLM providers without modifying source code.

### Solution
Introduced a centralized `getModelForPurpose()` function that reads model/provider configuration from environment variables.

### Changes to `apps/api/src/lib/generic-ai.ts`

Added new types and configuration:

```typescript
export type ModelPurpose =
  | "extract"           // Main extraction model
  | "extract_fallback"  // Fallback/retry extraction model
  | "schema_analysis"   // Schema analysis for multi-entity detection
  | "schema_generation" // Generate schema from prompt
  | "reranker"          // URL relevance scoring
  | "reranker_fallback" // Reranker fallback
  | "url_processor"     // URL processing/rephrasing
  | "summary"           // Page summarization
  | "branding"          // Branding extraction
  | "engpicker"         // Engine picker evaluation
  | "llmstxt"           // LLMs.txt generation
  | "deep_research"     // Deep research final analysis
  | "deep_research_planning"; // Deep research planning

const defaultModels: Record<ModelPurpose, { model: string; provider: Provider }> = {
  extract:              { model: "gpt-4o-mini", provider: "openai" },
  extract_fallback:     { model: "gpt-4.1", provider: "openai" },
  schema_analysis:      { model: "gpt-4.1", provider: "openai" },
  schema_generation:    { model: "gpt-4o-mini", provider: "openai" },
  reranker:             { model: "gemini-2.5-pro", provider: "vertex" },
  reranker_fallback:    { model: "gemini-2.5-pro", provider: "google" },
  url_processor:        { model: "gpt-4.1", provider: "openai" },
  summary:              { model: "gpt-4o-mini", provider: "openai" },
  branding:             { model: "gpt-4o-mini", provider: "openai" },
  engpicker:            { model: "gpt-4o-mini", provider: "openai" },
  llmstxt:              { model: "gpt-4o-mini", provider: "openai" },
  deep_research:        { model: "o3-mini", provider: "openai" },
  deep_research_planning: { model: "gpt-4o-mini", provider: "openai" },
};

export function getModelForPurpose(purpose: ModelPurpose) {
  const envMapping = purposeEnvVars[purpose];
  const modelName = (config[envMapping.model] as string) || defaultModels[purpose].model;
  const providerName = ((config[envMapping.provider] as string) || defaultModels[purpose].provider) as Provider;
  return providerList[providerName](modelName);
}
```

### Files Updated to Use `getModelForPurpose()`

| File | Change |
|------|--------|
| `llmExtract.ts` | Replaced `getModel()` with `getModelForPurpose("extract")` and `getModelForPurpose("extract_fallback")` |
| `singleAnswer.ts` | Updated model selection |
| `batchExtract.ts` | Updated model selection |
| `analyzeSchemaAndPrompt.ts` | Updated to use `schema_analysis` purpose |
| `reranker.ts` | Updated to use `reranker` and `reranker_fallback` purposes |
| `url-processor.ts` | Updated to use `url_processor` purpose |
| `branding/llm.ts` | Updated to use `branding` purpose |
| `engpicker.ts` | Updated to use `engpicker` purpose |
| `generate-llmstxt-service.ts` | Updated to use `llmstxt` purpose |
| `research-manager.ts` | Updated to use `deep_research` and `deep_research_planning` purposes |
| All fire-0 equivalents | Same updates applied |

---

## 2. Environment Variables Configuration

### Changes to `apps/api/src/config.ts`

Added Zod schema entries for all per-purpose model configuration:

```typescript
// Per-purpose model configuration
EXTRACT_MODEL: z.string().optional(),
EXTRACT_MODEL_PROVIDER: z.string().optional(),
EXTRACT_FALLBACK_MODEL: z.string().optional(),
EXTRACT_FALLBACK_MODEL_PROVIDER: z.string().optional(),
SCHEMA_ANALYSIS_MODEL: z.string().optional(),
SCHEMA_ANALYSIS_MODEL_PROVIDER: z.string().optional(),
SCHEMA_GENERATION_MODEL: z.string().optional(),
SCHEMA_GENERATION_MODEL_PROVIDER: z.string().optional(),
RERANKER_MODEL: z.string().optional(),
RERANKER_MODEL_PROVIDER: z.string().optional(),
RERANKER_FALLBACK_MODEL: z.string().optional(),
RERANKER_FALLBACK_MODEL_PROVIDER: z.string().optional(),
URL_PROCESSOR_MODEL: z.string().optional(),
URL_PROCESSOR_MODEL_PROVIDER: z.string().optional(),
SUMMARY_MODEL: z.string().optional(),
SUMMARY_MODEL_PROVIDER: z.string().optional(),
BRANDING_MODEL: z.string().optional(),
BRANDING_MODEL_PROVIDER: z.string().optional(),
ENGPICKER_MODEL: z.string().optional(),
ENGPICKER_MODEL_PROVIDER: z.string().optional(),
LLMSTXT_MODEL: z.string().optional(),
LLMSTXT_MODEL_PROVIDER: z.string().optional(),
DEEP_RESEARCH_MODEL: z.string().optional(),
DEEP_RESEARCH_MODEL_PROVIDER: z.string().optional(),
DEEP_RESEARCH_PLANNING_MODEL: z.string().optional(),
DEEP_RESEARCH_PLANNING_MODEL_PROVIDER: z.string().optional(),
```

### Changes to `docker-compose.yaml`

Added environment variable pass-through for all new variables to the `api` service.

### Example `.env` Configuration for Gemini

```bash
# Google AI Studio API Key
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...your-key...

# Extraction (main workhorse)
EXTRACT_MODEL=gemini-2.0-flash
EXTRACT_MODEL_PROVIDER=google

# Fallback extraction (more capable model)
EXTRACT_FALLBACK_MODEL=gemini-2.5-pro
EXTRACT_FALLBACK_MODEL_PROVIDER=google

# Schema analysis
SCHEMA_ANALYSIS_MODEL=gemini-2.5-flash
SCHEMA_ANALYSIS_MODEL_PROVIDER=google

# Schema generation from prompt
SCHEMA_GENERATION_MODEL=gemini-2.0-flash
SCHEMA_GENERATION_MODEL_PROVIDER=google

# URL reranking
RERANKER_MODEL=gemini-2.5-flash
RERANKER_MODEL_PROVIDER=google
RERANKER_FALLBACK_MODEL=gemini-2.5-pro
RERANKER_FALLBACK_MODEL_PROVIDER=google

# URL processing
URL_PROCESSOR_MODEL=gemini-2.0-flash
URL_PROCESSOR_MODEL_PROVIDER=google
```

---

## 3. Google AI Studio Compatibility Fix

### Problem
When using `provider: "google"` (Google AI Studio), API calls failed with:
```
Invalid JSON payload received. Unknown name "labels": Cannot find field.
```

### Cause
The code included Vertex AI-specific `labels` in `providerOptions.google`, but Google AI Studio doesn't support this field.

### Solution
Removed `labels` from `providerOptions.google` in all `generateObject` and `generateText` calls.

### Files Modified

| File | Change |
|------|--------|
| `llmExtract.ts` | Removed `labels` from `providerOptions.google` |
| `url-processor.ts` | Removed `labels` from `providerOptions.google` |
| `llmExtract-f0.ts` | Removed `labels` from `providerOptions.google` |
| `url-processor-f0.ts` | Removed `labels` from `providerOptions.google` |

### Before
```typescript
providerOptions: {
  google: {
    labels: {
      extractId: metadata.extractId,
      teamId: metadata.teamId,
    },
  },
},
```

### After
```typescript
providerOptions: {
  // Labels removed - not supported by Google AI Studio
},
```

---

## 4. Token Usage Tracking Fix

### Problem
The extract endpoint returned `llmUsage: 0` even though extractions were working correctly.

### Cause
Multiple issues in the token usage pipeline:

1. `extractData()` function tracked costs via `costTracking` but didn't return `totalUsage`
2. `singleAnswerCompletion()` had hardcoded zeros for token usage
3. `batchExtract()` had the same hardcoded zeros
4. `generateCompletions()` didn't include `model` in the `totalUsage` object

### Solution

#### Fix 1: `extractSmartScrape.ts`

Added `totalUsage` to return type and return statement:

```typescript
// Before
}): Promise<{
  extractedDataArray: any[];
  warning: any;
  costLimitExceededTokenUsage: number | null;
}>

// After  
}): Promise<{
  extractedDataArray: any[];
  warning: any;
  costLimitExceededTokenUsage: number | null;
  totalUsage?: TokenUsage;  // Added
}>

// Return statement
return {
  extractedDataArray: extractedData,
  warning: warning,
  costLimitExceededTokenUsage: costLimitExceededTokenUsage,
  totalUsage: totalUsage,  // Added
};
```

#### Fix 2: `singleAnswer.ts`

Updated to use returned `totalUsage` instead of hardcoded zeros:

```typescript
// Before
const completion = {
  extract: extractedDataArray,
  tokenUsage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    model: "gemini-2.5-pro",
  },
  ...
};

// After
const { extractedDataArray, warning, totalUsage } = await extractData({...});

const completion = {
  extract: extractedDataArray,
  tokenUsage: totalUsage ?? {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    model: "unknown",
  },
  ...
};
```

#### Fix 3: `batchExtract.ts`

Same pattern applied - use returned `totalUsage` from `extractData()`.

#### Fix 4: `llmExtract.ts` and `llmExtract-f0.ts`

Added `model` field to all `totalUsage` return objects:

```typescript
// Before
totalUsage: {
  promptTokens,
  completionTokens,
  totalTokens: promptTokens + completionTokens,
},

// After
totalUsage: {
  promptTokens,
  completionTokens,
  totalTokens: promptTokens + completionTokens,
  model: modelId,  // Added - required for cost lookup
},
```

---

## 5. Comprehensive Fire-0 Cost Tracking

### Problem
The fire-0 extraction path was missing cost tracking for several LLM operations:
- URL rephrasing (`generateBasicCompletion_FO`)
- Pre-rerank prompt generation
- LLM reranking (`rerankLinksWithLLM_F0`)

### Solution

#### Fix 1: `url-processor-f0.ts`

Updated `generateBasicCompletion_FO` to accept and use `CostTracking`:

```typescript
export async function generateBasicCompletion_FO(
  prompt: string,
  metadata: { teamId: string; extractId?: string },
  costTracking?: CostTracking,  // Added
) {
  // ... generate text ...
  
  // Track cost if costTracking is provided
  if (costTracking) {
    costTracking.addCall({
      metadata: { module: "extract", method: "generateBasicCompletion_F0" },
      cost: 0,
      model: modelId,
      tokens: {
        input: usage?.promptTokens ?? 0,
        output: usage?.completionTokens ?? 0,
      },
    });
  }
  return text;
}
```

Updated `processUrl_F0` to accept and pass `CostTracking` to all LLM calls.

#### Fix 2: `reranker-f0.ts`

Fixed the reranker to use the passed-in `CostTracking` instead of creating a new one:

```typescript
// Before
costTrackingOptions: {
  costTracking: new CostTracking(),  // Throwaway!
  ...
},

// After
costTrackingOptions: {
  costTracking: costTracking,  // Use passed-in tracker
  ...
},
```

#### Fix 3: `extraction-service-f0.ts`

Added `CostTracking` instance and merged all costs:

```typescript
// Create cost tracking for URL processing, reranking, etc.
const costTracking = new CostTracking();

// Pass to URL processing
processUrl_F0(..., costTracking);

// Merge all costs in final logging
const costTrackingData = costTracking.toJSON();
const allCalls = [
  ...tokenUsage.map(...),  // Extraction costs
  ...costTrackingData.calls,  // URL processing, reranking costs
];
```

---

## 6. Cost Calculation Bug Fix

### Problem
Costs were being massively overestimated (e.g., $0.34 instead of $0.0003).

### Cause
The `trimToTokenLimit_F0()` function uses `tiktoken` to count tokens, but `tiktoken` only supports OpenAI models. For Gemini models:

1. `tiktoken.encoding_for_model("gemini-2.0-flash")` throws an error
2. The catch block falls back to: `numTokens: maxTokens`
3. For Gemini with 1M+ context: `maxTokens = 1,048,576 * 0.8 = 838,860`
4. This huge number was used as `promptTokens` in cost calculation

### Evidence from Logs
```
Cost calculation for F0: model=gemini-2.5-flash, promptTokens=838860, ...
```

### Solution

Updated `llmExtract-f0.ts` to use **actual token counts from API response** instead of estimates:

```typescript
// Before
const promptTokens = numTokens;  // Used estimate (potentially 838,860!)
const completionTokens = result?.usage?.outputTokens ?? 0;

// After
const promptTokens = result?.usage?.inputTokens ?? numTokens;  // Use API response
const completionTokens = result?.usage?.outputTokens ?? 0;
```

Applied to both return paths in `generateCompletions_F0()`:
1. The `generateText` path (no-object mode)
2. The `generateObject` path (main extraction)

### Result

| Metric | Before (Bug) | After (Fixed) |
|--------|--------------|---------------|
| `llmUsage` | $0.3357 | $0.0003 |
| `promptTokens` | 838,860 | 324 |
| Accuracy | ~1000x overestimate | Correct |

---

## 7. Async Job Cost Tracking Visibility

### Problem
For async extract jobs (queued via `origin: "api-sdk"`), the detailed `costTracking` breakdown was not visible in the status endpoint response, even when `__experimental_showCostTracking: true` was set.

### Cause
The `costTracking` data was only passed to `logExtract()` (database logging), not to `updateExtract()` (Redis storage for status endpoint).

### Solution

Updated `extraction-service-f0.ts` to include `costTracking` in the Redis update:

```typescript
updateExtract(extractId, {
  status: "completed",
  llmUsage,
  sources,
  tokensBilled: tokensToBill,
  creditsBilled: creditsToBill,
  costTracking: {  // Added
    totalCalls: allCalls.length,
    totalInputTokens: totalInputTokens,
    totalOutputTokens: totalOutputTokens,
    totalCost: totalCost,
    calls: allCalls,
  },
});
```

---

## 8. Python SDK Cost Tracking Support

### Problem
The Python SDK (`apps/python-sdk/`) didn't have fields to capture the detailed cost tracking data returned by our patched Firecrawl API.

### Solution
Added new types and parameters to the Python SDK to fully support cost tracking with configurable verbosity.

### New Types Added

#### v1 SDK (`apps/python-sdk/firecrawl/v1/types.py`)

```python
class V1CostTrackingCall(pydantic.BaseModel):
    """A single LLM call in the cost tracking breakdown."""
    cost: Optional[float] = None
    model: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    tokens: Optional[Dict[str, int]] = None
    stack: Optional[str] = None  # Only with verbosity="full"


class V1CostTrackingData(pydantic.BaseModel):
    """Detailed cost tracking breakdown for extract operations."""
    # Summary fields (always present)
    totalCalls: Optional[int] = None
    totalInputTokens: Optional[int] = None
    totalOutputTokens: Optional[int] = None
    totalCost: Optional[float] = None
    # Detailed fields
    calls: Optional[List[V1CostTrackingCall]] = None


class V1ExtractResponse(pydantic.BaseModel):
    # ... existing fields ...
    llmUsage: Optional[float] = None  # DEPRECATED
    costTracking: Optional[V1CostTrackingData] = None
    tokensUsed: Optional[int] = None
```

#### v2 SDK (`apps/python-sdk/firecrawl/v2/types.py`)

```python
class CostTrackingCall(BaseModel):
    cost: Optional[float] = None
    model: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    tokens: Optional[Dict[str, int]] = None
    stack: Optional[str] = None


class CostTrackingData(BaseModel):
    total_calls: Optional[int] = None
    total_input_tokens: Optional[int] = None
    total_output_tokens: Optional[int] = None
    total_cost: Optional[float] = None
    calls: Optional[List[CostTrackingCall]] = None
```

### New Parameters

Both v1 and v2 SDKs now accept:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | `int` | Maximum number of pages to scrape |
| `show_cost_tracking` | `bool` | Include cost tracking data |
| `cost_tracking_verbosity` | `Literal["summary", "detailed", "full"]` | Control detail level |

> **Note:** `show_llm_usage` is deprecated but still available for backward compatibility.

---

## 9. Cost Tracking Verbosity System

### Problem
The original cost tracking output was verbose and included unnecessary information for most use cases, such as stack traces in every call and SmartScrape-specific fields that didn't apply to self-hosted deployments.

### Solution
Implemented a three-tier verbosity system with configurable output levels.

### Verbosity Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `"summary"` | Only aggregate totals | Production dashboards, lightweight logging |
| `"detailed"` | Totals + per-call breakdown (no stack traces) | **Default**. Normal monitoring, cost analysis |
| `"full"` | Everything including stack traces | Debugging failed extractions |

### API Parameter

Added `__experimental_costTrackingVerbosity` to the extract endpoint:

```typescript
__experimental_costTrackingVerbosity: z
  .enum(["summary", "detailed", "full"])
  .default("detailed")
  .optional()
```

### Response Formats

#### Summary Verbosity

```json
{
  "costTracking": {
    "totalCalls": 5,
    "totalInputTokens": 6030,
    "totalOutputTokens": 288,
    "totalCost": 0.0010445
  }
}
```

#### Detailed Verbosity (Default)

```json
{
  "costTracking": {
    "totalCalls": 5,
    "totalInputTokens": 6030,
    "totalOutputTokens": 288,
    "totalCost": 0.0010445,
    "calls": [
      {
        "cost": 0.0004511,
        "model": "gemini-2.5-flash",
        "metadata": {"source": "extraction"},
        "tokens": {"input": 337, "output": 140}
      }
    ]
  }
}
```

#### Full Verbosity

Same as detailed, but includes `stack` field in each call for debugging purposes.

---

## 10. SmartScrape Cleanup & Self-Hosted Simplification

### Problem
The cost tracking output included SmartScrape-specific fields that were always `0` for self-hosted deployments and added unnecessary complexity.

### What is SmartScrape?
SmartScrape is a Firecrawl Cloud feature that uses browser automation (Playwright) to interact with pages requiring user interaction. It requires separate infrastructure (`SMART_SCRAPE_API_URL`) that most self-hosted deployments don't have.

### Changes Made

**Removed fields:**
- `type: "smartScrape" | "other"` distinction in call tracking
- `smartScrapeCallCount`, `smartScrapeCost`
- `otherCallCount`, `otherCost`

**Updated all `addCall()` usages** to remove the `type` parameter:

```typescript
// Before
costTracking.addCall({
  type: "other",
  metadata: {...},
  cost: 0.001,
  model: "gemini-2.0-flash",
  tokens: {...}
});

// After
costTracking.addCall({
  metadata: {...},
  cost: 0.001,
  model: "gemini-2.0-flash",
  tokens: {...}
});
```

**Files modified:**
- `apps/api/src/lib/cost-tracking.ts` - Core rewrite
- `apps/api/src/lib/extract/fire-0/url-processor-f0.ts`
- `apps/api/src/lib/extract/url-processor.ts`
- `apps/api/src/scraper/scrapeURL/transformers/llmExtract.ts`
- `apps/api/src/scraper/scrapeURL/lib/smartScrape.ts`

### Firecrawl Internal Billing Fields

These fields remain but are **NOT related to LLM token usage**:
- `tokensUsed` = `JSON.stringify(result).length / 4 + 300` (based on output size)
- `creditsUsed` = `Math.ceil(tokensUsed / 15)` (Firecrawl's proprietary credit system)

For actual LLM cost tracking, use `costTracking.totalInputTokens`, `costTracking.totalOutputTokens`, and `costTracking.totalCost`.

---

## 11. v1 vs v2 API Compatibility

### Problem
The v2 API's extract-status endpoint requires Supabase, making it incompatible with self-hosted deployments that only have Redis.

### Why v2 Fails on Self-Hosted

The v2 `extract-status.ts` controller calls `supabaseGetExtractRequestByIdDirect()` before checking Redis:

```typescript
// v2 controller - requires Supabase first
const extractRequest = await supabaseGetExtractRequestByIdDirect(req.params.jobId);
if (!extractRequest) return 404;  // Fails here without Supabase!
```

The v1 controller uses Redis first:

```typescript
// v1 controller - uses Redis first (self-hosted compatible)
const extract = await getExtract(req.params.jobId);  // Works!
```

### Comparison

| Aspect | v1 API | v2 API |
|--------|--------|--------|
| **Endpoint** | `/v1/extract` | `/v2/extract` |
| **Self-hosted compatible** | ✅ Yes (uses Redis) | ❌ Requires Supabase |
| **Cost tracking** | ✅ Works | ⚠️ Fails without Supabase |
| **Python SDK (unified)** | `app.v1.extract()` | `app.extract()` |
| **Python SDK (dedicated)** | `V1FirecrawlApp` | `FirecrawlClient` |
| **Response field naming** | camelCase (`costTracking`) | snake_case (`cost_tracking`) |

### Recommendation

⚠️ **For self-hosted deployments without Supabase, use the v1 API.**

---

## 12. Files Modified Summary

### Core Model Configuration
| File | Purpose |
|------|---------|
| `apps/api/src/lib/generic-ai.ts` | Added `getModelForPurpose()` and model configuration |
| `apps/api/src/config.ts` | Added env var schemas for all model purposes |
| `docker-compose.yaml` | Added env var pass-through |

### Extraction Pipeline (Fire-1)
| File | Changes |
|------|---------|
| `apps/api/src/scraper/scrapeURL/transformers/llmExtract.ts` | Model selection, removed labels, added model to totalUsage |
| `apps/api/src/lib/extract/completions/singleAnswer.ts` | Use returned totalUsage |
| `apps/api/src/lib/extract/completions/batchExtract.ts` | Use returned totalUsage |
| `apps/api/src/lib/extract/completions/analyzeSchemaAndPrompt.ts` | Model selection |
| `apps/api/src/lib/extract/reranker.ts` | Model selection |
| `apps/api/src/lib/extract/url-processor.ts` | Model selection, removed labels |
| `apps/api/src/scraper/scrapeURL/lib/extractSmartScrape.ts` | Return totalUsage |

### Extraction Pipeline (Fire-0)
| File | Changes |
|------|---------|
| `apps/api/src/lib/extract/fire-0/llmExtract-f0.ts` | Model selection, removed labels, fixed token counting, added model to totalUsage |
| `apps/api/src/lib/extract/fire-0/completions/singleAnswer-f0.ts` | Uses existing correct pattern |
| `apps/api/src/lib/extract/fire-0/completions/batchExtract-f0.ts` | Uses existing correct pattern |
| `apps/api/src/lib/extract/fire-0/completions/analyzeSchemaAndPrompt-f0.ts` | Model selection |
| `apps/api/src/lib/extract/fire-0/url-processor-f0.ts` | Model selection, removed labels, added CostTracking support |
| `apps/api/src/lib/extract/fire-0/reranker-f0.ts` | Fixed to use passed-in CostTracking |
| `apps/api/src/lib/extract/fire-0/extraction-service-f0.ts` | Added CostTracking, merged all costs, exposed in Redis |

### Cost Tracking System
| File | Changes |
|------|---------|
| `apps/api/src/lib/cost-tracking.ts` | Complete rewrite: removed `type` field, added verbosity support, added token aggregates |
| `apps/api/src/lib/extract/extract-redis.ts` | Updated `StoredExtract` type, added `costTrackingVerbosity` field |
| `apps/api/src/controllers/v1/types.ts` | Added `__experimental_costTrackingVerbosity`, marked `__experimental_llmUsage` as deprecated |
| `apps/api/src/controllers/v2/types.ts` | Same as v1 |
| `apps/api/src/controllers/v1/extract.ts` | Save `costTrackingVerbosity` to Redis |
| `apps/api/src/controllers/v2/extract.ts` | Same as v1 |
| `apps/api/src/controllers/v1/extract-status.ts` | Apply verbosity when returning `costTracking` |
| `apps/api/src/controllers/v2/extract-status.ts` | Same as v1 (but requires Supabase) |
| `apps/api/src/lib/extract/extraction-service.ts` | Updated `ExtractResult` type, return `costTracking` |
| `apps/api/src/services/extract-worker.ts` | Pass `costTracking` to `updateExtract()` |

### Other Modules
| File | Changes |
|------|---------|
| `apps/api/src/lib/branding/llm.ts` | Model selection |
| `apps/api/src/lib/engpicker.ts` | Model selection |
| `apps/api/src/lib/generate-llmstxt/generate-llmstxt-service.ts` | Model selection |
| `apps/api/src/lib/deep-research/research-manager.ts` | Model selection |

### Python SDK - v1
| File | Changes |
|------|---------|
| `apps/python-sdk/firecrawl/v1/client.py` | Added V1CostTrackingCall, V1CostTrackingData |
| `apps/python-sdk/firecrawl/v1/types.py` | Updated V1ExtractResponse with cost fields, added cost params to extract(), async_extract() |

### Python SDK - v2
| File | Changes |
|------|---------|
| `apps/python-sdk/firecrawl/v2/types.py` | Updated CostTrackingCall, CostTrackingData |
| `apps/python-sdk/firecrawl/v2/methods/extract.py` | Add verbosity param, updated normalization |
| `apps/python-sdk/firecrawl/v2/methods/aio/extract.py` | Add verbosity param (async) |
| `apps/python-sdk/firecrawl/v2/client.py` | Expose new param |
| `apps/python-sdk/firecrawl/v2/client_async.py` | Expose new param (async) |

---

## 13. Testing & Verification

### Test 1: Synchronous Extract (Quick Test)

```bash
curl -s -X POST http://localhost:3002/v1/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-test" \
  -d '{
    "urls": ["https://firecrawl.dev/*"],
    "prompt": "Extract company information, features, and pricing",
    "schema": {
      "type": "object",
      "properties": {
        "companyName": { "type": "string" },
        "features": { "type": "array", "items": { "type": "string" } },
        "pricingPlans": { "type": "array", "items": { "type": "object" } }
      }
    },
    "limit": 5,
    "showSources": true
  }' | jq .
```

**Expected Results:**

```json
{
  "success": true,
  "data": { ... },
  "llmUsage": 0.0036771,  // Realistic cost ~$0.004
  "totalUrlsScraped": 5,
  "sources": { ... }
}
```

### Test 2: Async Job with Detailed Cost Tracking

**Step 1: Submit async job**
```bash
RESPONSE=$(curl -s -X POST http://localhost:3002/v1/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-test" \
  -d '{
    "urls": ["https://firecrawl.dev/*"],
    "prompt": "Extract company name",
    "schema": {
      "type": "object",
      "properties": {
        "companyName": { "type": "string" }
      }
    },
    "limit": 2,
    "origin": "api-sdk",
    "__experimental_showCostTracking": true,
    "__experimental_costTrackingVerbosity": "detailed",
    "showSources": true
  }')

JOB_ID=$(echo "$RESPONSE" | jq -r '.id')
echo "Job ID: $JOB_ID"
```

**Step 2: Poll for completion**
```bash
# Wait ~30-40 seconds, then:
curl -s "http://localhost:3002/v1/extract/$JOB_ID" \
  -H "Authorization: Bearer fc-test" | jq .
```

**Expected Results:**
- `status: "completed"`
- `costTracking.totalCost`: Total cost in dollars
- `costTracking.totalCalls`: Number of LLM calls
- `costTracking.totalInputTokens`: Total input tokens
- `costTracking.totalOutputTokens`: Total output tokens
- `costTracking.calls[]`: Detailed breakdown of each LLM call

### Test 3: Python SDK with Cost Tracking (v1)

```python
from firecrawl import FirecrawlApp

# Point to self-hosted instance
app = FirecrawlApp(
    api_key="fc-test",
    api_url="http://localhost:3002"
)

# Use app.v1.extract() for self-hosted (calls /v1/extract)
result = app.v1.extract(
    urls=["https://firecrawl.dev/*"],
    prompt="Extract the company name and main features",
    schema={
        "type": "object",
        "properties": {
            "companyName": {"type": "string"},
            "features": {"type": "array", "items": {"type": "string"}}
        }
    },
    limit=3,
    show_sources=True,
    show_cost_tracking=True,
    cost_tracking_verbosity="detailed",
)

# Access cost tracking (v1 uses camelCase!)
if result.costTracking:
    print(f"\nCost Summary:")
    print(f"  Total calls: {result.costTracking.totalCalls}")
    print(f"  Input tokens: {result.costTracking.totalInputTokens}")
    print(f"  Output tokens: {result.costTracking.totalOutputTokens}")
    print(f"  Total cost: ${result.costTracking.totalCost:.6f}")
```

**Expected Output:**
```
Cost Summary:
  Total calls: 3
  Input tokens: 15500
  Output tokens: 150
  Total cost: $0.001234
```

### Verifying Token Counts (via logs)
```bash
docker compose logs api --tail 20 | grep "Cost calculation"
```

Expected output:
```
Cost calculation for F0: model=gemini-2.0-flash, promptTokens=27551, completionTokens=839, totalTokens=28390
```

---

## Deployment Checklist

1. ✅ Update `.env` with Gemini model configuration
2. ✅ Ensure `docker-compose.yaml` has all new env vars
3. ✅ Rebuild: `docker compose build api`
4. ✅ Restart: `docker compose up -d`
5. ✅ Test synchronous extract endpoint
6. ✅ Verify `costTracking.totalCost` shows realistic costs (fractions of a cent)
7. ✅ Check logs for correct token counts
8. ✅ Test async job with `__experimental_showCostTracking: true`
9. ✅ Verify `costTracking.totalCalls`, `totalInputTokens`, `totalOutputTokens` are populated
10. ✅ Test Python SDK with `show_cost_tracking=True` and `cost_tracking_verbosity="detailed"`
11. ✅ Verify v1 API (`app.v1.extract()`) works for self-hosted deployments

---

## Cost Reference (Gemini Models)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gemini-2.0-flash | $0.10 | $0.40 |
| gemini-2.5-flash | $0.30 | $2.50 |
| gemini-2.5-pro | $1.25 | $10.00 |

### Typical Extraction Costs
| Scenario | Pages | Tokens | Cost |
|----------|-------|--------|------|
| Simple (example.com) | 1 | ~700 | ~$0.0003 |
| Medium (5 pages) | 5 | ~30,000 | ~$0.004 |
| Complex (10 pages) | 10 | ~60,000 | ~$0.008 |

---

## Summary

| Before | After |
|--------|-------|
| Hardcoded OpenAI models | ✅ Per-task model configuration with env vars |
| Google AI Studio labels error | ✅ Fixed - labels removed |
| `llmUsage` always $0 | ✅ Accurate cost tracking |
| Missing Fire-0 cost tracking | ✅ Comprehensive tracking across all paths |
| 1000x cost overestimation | ✅ Fixed - uses API token counts |
| Async jobs missing cost data | ✅ Stored in Redis and returned |
| Python SDK missing cost fields | ✅ Full support in v1 and v2 |
| Verbose output with SmartScrape fields | ✅ Cleaned up, configurable verbosity |
| No verbosity control | ✅ Three levels: summary, detailed, full |
| v2 incompatible with self-hosted | ✅ Documented - use v1 instead |

