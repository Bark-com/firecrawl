import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../config";
import { createOllama } from "ollama-ai-provider";
import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { fireworks } from "@ai-sdk/fireworks";
import { deepinfra } from "@ai-sdk/deepinfra";
import { createVertex } from "@ai-sdk/google-vertex";

export type Provider =
  | "openai"
  | "ollama"
  | "anthropic"
  | "groq"
  | "google"
  | "openrouter"
  | "fireworks"
  | "deepinfra"
  | "vertex";
const defaultProvider: Provider = config.OLLAMA_BASE_URL ? "ollama" : "openai";

const providerList: Record<Provider, any> = {
  openai: createOpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
  }), //OPENAI_API_KEY
  ollama: createOllama({
    baseURL: config.OLLAMA_BASE_URL,
  }),
  anthropic, //ANTHROPIC_API_KEY
  groq, //GROQ_API_KEY
  google, //GOOGLE_GENERATIVE_AI_API_KEY
  openrouter: createOpenRouter({
    apiKey: config.OPENROUTER_API_KEY,
  }),
  fireworks, //FIREWORKS_API_KEY
  deepinfra, //DEEPINFRA_API_KEY
  vertex: createVertex({
    project: config.VERTEX_PROJECT || "firecrawl",
    //https://github.com/vercel/ai/issues/6644 bug
    baseURL: config.VERTEX_BASE_URL ||
      "https://aiplatform.googleapis.com/v1/projects/firecrawl/locations/global/publishers/google",
    location: config.VERTEX_LOCATION || "global",
    googleAuthOptions: config.VERTEX_CREDENTIALS
      ? {
          credentials: JSON.parse(atob(config.VERTEX_CREDENTIALS)),
        }
      : {
          keyFile: "./gke-key.json",
        },
  }),
};

// ============================================================================
// Model Purpose Configuration
// ============================================================================
// Each purpose can be configured via environment variables to use a specific
// model and provider. This allows per-task model customization.

export type ModelPurpose =
  | "extract"           // Main extraction model (default: gpt-4o-mini)
  | "extract_fallback"  // Fallback/retry extraction model (default: gpt-4.1)
  | "schema_analysis"   // Schema analysis for multi-entity detection (default: gpt-4.1)
  | "schema_generation" // Generate schema from prompt (default: gpt-4o-mini)
  | "reranker"          // URL relevance scoring (default: gemini-2.5-pro)
  | "reranker_fallback" // Reranker fallback (default: gemini-2.5-pro)
  | "url_processor"     // URL processing/rephrasing (default: gpt-4.1)
  | "summary"           // Page summarization (default: gpt-4o-mini)
  | "branding"          // Branding extraction (default: gpt-4o-mini)
  | "engpicker"         // Engine picker evaluation (default: gpt-4o-mini)
  | "llmstxt"           // LLMs.txt generation (default: gpt-4o-mini)
  | "deep_research"     // Deep research final analysis (default: o3-mini)
  | "deep_research_planning"; // Deep research planning (default: gpt-4o-mini)

// Default model configurations for each purpose
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

// Environment variable mapping for per-purpose model configuration
const purposeEnvVars: Record<ModelPurpose, { model: string; provider: string }> = {
  extract:              { model: "EXTRACT_MODEL", provider: "EXTRACT_MODEL_PROVIDER" },
  extract_fallback:     { model: "EXTRACT_FALLBACK_MODEL", provider: "EXTRACT_FALLBACK_MODEL_PROVIDER" },
  schema_analysis:      { model: "SCHEMA_ANALYSIS_MODEL", provider: "SCHEMA_ANALYSIS_MODEL_PROVIDER" },
  schema_generation:    { model: "SCHEMA_GENERATION_MODEL", provider: "SCHEMA_GENERATION_MODEL_PROVIDER" },
  reranker:             { model: "RERANKER_MODEL", provider: "RERANKER_MODEL_PROVIDER" },
  reranker_fallback:    { model: "RERANKER_FALLBACK_MODEL", provider: "RERANKER_FALLBACK_MODEL_PROVIDER" },
  url_processor:        { model: "URL_PROCESSOR_MODEL", provider: "URL_PROCESSOR_MODEL_PROVIDER" },
  summary:              { model: "SUMMARY_MODEL", provider: "SUMMARY_MODEL_PROVIDER" },
  branding:             { model: "BRANDING_MODEL", provider: "BRANDING_MODEL_PROVIDER" },
  engpicker:            { model: "ENGPICKER_MODEL", provider: "ENGPICKER_MODEL_PROVIDER" },
  llmstxt:              { model: "LLMSTXT_MODEL", provider: "LLMSTXT_MODEL_PROVIDER" },
  deep_research:        { model: "DEEP_RESEARCH_MODEL", provider: "DEEP_RESEARCH_MODEL_PROVIDER" },
  deep_research_planning: { model: "DEEP_RESEARCH_PLANNING_MODEL", provider: "DEEP_RESEARCH_PLANNING_MODEL_PROVIDER" },
};

/**
 * Get a model configured for a specific purpose.
 * 
 * Priority:
 * 1. Purpose-specific env vars (e.g., EXTRACT_MODEL, EXTRACT_MODEL_PROVIDER)
 * 2. Global MODEL_NAME override (applies to all purposes)
 * 3. Default model for the purpose
 * 
 * @param purpose - The purpose/task for which the model is needed
 * @returns The configured model for the AI SDK
 */
export function getModelForPurpose(purpose: ModelPurpose) {
  const envVars = purposeEnvVars[purpose];
  const defaults = defaultModels[purpose];
  
  // Check for purpose-specific env var override
  const purposeModel = config[envVars.model as keyof typeof config] as string | undefined;
  const purposeProvider = config[envVars.provider as keyof typeof config] as Provider | undefined;
  
  if (purposeModel) {
    const provider = purposeProvider || defaults.provider;
    return providerList[provider](purposeModel);
  }
  
  // Check for global MODEL_NAME override
  if (config.MODEL_NAME) {
    const provider = purposeProvider || defaults.provider;
    return providerList[provider](config.MODEL_NAME);
  }
  
  // Use default
  return providerList[defaults.provider](defaults.model);
}

/**
 * Get model info for logging/debugging
 */
export function getModelInfoForPurpose(purpose: ModelPurpose): { model: string; provider: Provider } {
  const envVars = purposeEnvVars[purpose];
  const defaults = defaultModels[purpose];
  
  const purposeModel = config[envVars.model as keyof typeof config] as string | undefined;
  const purposeProvider = config[envVars.provider as keyof typeof config] as Provider | undefined;
  
  if (purposeModel) {
    return {
      model: purposeModel,
      provider: purposeProvider || defaults.provider,
    };
  }
  
  if (config.MODEL_NAME) {
    return {
      model: config.MODEL_NAME,
      provider: purposeProvider || defaults.provider,
    };
  }
  
  return defaults;
}

// ============================================================================
// Legacy getModel function (for backward compatibility)
// ============================================================================

export function getModel(name: string, provider: Provider = defaultProvider) {
  if (name === "gemini-2.5-pro") {
    name = "gemini-2.5-pro";
  }
  return config.MODEL_NAME
    ? providerList[provider](config.MODEL_NAME)
    : providerList[provider](name);
}

export function getEmbeddingModel(
  name: string,
  provider: Provider = defaultProvider,
) {
  return config.MODEL_EMBEDDING_NAME
    ? providerList[provider].embedding(config.MODEL_EMBEDDING_NAME)
    : providerList[provider].embedding(name);
}
