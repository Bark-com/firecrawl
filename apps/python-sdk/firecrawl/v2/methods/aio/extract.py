from typing import Any, Dict, List, Literal, Optional
import asyncio

from ...types import ExtractResponse, ScrapeOptions, AgentOptions
from ...utils.http_client_async import AsyncHttpClient
from ...utils.validation import prepare_scrape_options


# Type alias for verbosity levels
CostTrackingVerbosity = Literal["summary", "detailed", "full"]


def _prepare_extract_request(
    urls: Optional[List[str]],
    *,
    prompt: Optional[str] = None,
    schema: Optional[Dict[str, Any]] = None,
    system_prompt: Optional[str] = None,
    allow_external_links: Optional[bool] = None,
    enable_web_search: Optional[bool] = None,
    show_sources: Optional[bool] = None,
    scrape_options: Optional[ScrapeOptions] = None,
    ignore_invalid_urls: Optional[bool] = None,
    integration: Optional[str] = None,
    agent: Optional[AgentOptions] = None,
    limit: Optional[int] = None,
    # Cost tracking options (for self-hosted)
    show_llm_usage: Optional[bool] = None,
    show_cost_tracking: Optional[bool] = None,
    cost_tracking_verbosity: Optional[CostTrackingVerbosity] = None,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {}
    if urls is not None:
        body["urls"] = urls
    if prompt is not None:
        body["prompt"] = prompt
    if schema is not None:
        body["schema"] = schema
    if system_prompt is not None:
        body["systemPrompt"] = system_prompt
    if allow_external_links is not None:
        body["allowExternalLinks"] = allow_external_links
    if enable_web_search is not None:
        body["enableWebSearch"] = enable_web_search
    if show_sources is not None:
        body["showSources"] = show_sources
    if ignore_invalid_urls is not None:
        body["ignoreInvalidURLs"] = ignore_invalid_urls
    if scrape_options is not None:
        prepared = prepare_scrape_options(scrape_options)
        if prepared:
            body["scrapeOptions"] = prepared
    if integration is not None and str(integration).strip():
        body["integration"] = str(integration).strip()
    if agent is not None:
        try:
            body["agent"] = agent.model_dump(exclude_none=True)  # type: ignore[attr-defined]
        except AttributeError:
            body["agent"] = agent  # fallback
    if limit is not None:
        body["limit"] = limit
    # Cost tracking flags (useful for self-hosted deployments)
    if show_llm_usage is not None:
        body["__experimental_llmUsage"] = show_llm_usage
    if show_cost_tracking is not None:
        body["__experimental_showCostTracking"] = show_cost_tracking
    if cost_tracking_verbosity is not None:
        body["__experimental_costTrackingVerbosity"] = cost_tracking_verbosity
    return body


def _normalize_extract_response_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize camelCase API response to snake_case for Pydantic model."""
    out = dict(payload)
    if "expiresAt" in out and "expires_at" not in out:
        out["expires_at"] = out["expiresAt"]
    if "creditsUsed" in out and "credits_used" not in out:
        out["credits_used"] = out["creditsUsed"]
    if "tokensUsed" in out and "tokens_used" not in out:
        out["tokens_used"] = out["tokensUsed"]
    # Cost tracking fields (from __experimental_showCostTracking and __experimental_llmUsage)
    if "llmUsage" in out and "llm_usage" not in out:
        out["llm_usage"] = out["llmUsage"]
    if "costTracking" in out and "cost_tracking" not in out:
        ct = out["costTracking"]
        if isinstance(ct, dict):
            # Normalize nested camelCase fields to snake_case
            normalized_ct: Dict[str, Any] = {}
            # New format fields (summary)
            if "totalCalls" in ct:
                normalized_ct["total_calls"] = ct["totalCalls"]
            if "totalInputTokens" in ct:
                normalized_ct["total_input_tokens"] = ct["totalInputTokens"]
            if "totalOutputTokens" in ct:
                normalized_ct["total_output_tokens"] = ct["totalOutputTokens"]
            if "totalCost" in ct:
                normalized_ct["total_cost"] = ct["totalCost"]
            # Calls array (detailed/full)
            if "calls" in ct:
                normalized_ct["calls"] = ct["calls"]  # Keep calls as-is
            out["cost_tracking"] = normalized_ct
        else:
            out["cost_tracking"] = ct
    return out


async def start_extract(
    client: AsyncHttpClient,
    urls: Optional[List[str]],
    *,
    prompt: Optional[str] = None,
    schema: Optional[Dict[str, Any]] = None,
    system_prompt: Optional[str] = None,
    allow_external_links: Optional[bool] = None,
    enable_web_search: Optional[bool] = None,
    show_sources: Optional[bool] = None,
    scrape_options: Optional[ScrapeOptions] = None,
    ignore_invalid_urls: Optional[bool] = None,
    integration: Optional[str] = None,
    agent: Optional[AgentOptions] = None,
    limit: Optional[int] = None,
    show_llm_usage: Optional[bool] = None,
    show_cost_tracking: Optional[bool] = None,
    cost_tracking_verbosity: Optional[CostTrackingVerbosity] = None,
) -> ExtractResponse:
    body = _prepare_extract_request(
        urls,
        prompt=prompt,
        schema=schema,
        system_prompt=system_prompt,
        allow_external_links=allow_external_links,
        enable_web_search=enable_web_search,
        show_sources=show_sources,
        scrape_options=scrape_options,
        ignore_invalid_urls=ignore_invalid_urls,
        integration=integration,
        agent=agent,
        limit=limit,
        show_llm_usage=show_llm_usage,
        show_cost_tracking=show_cost_tracking,
        cost_tracking_verbosity=cost_tracking_verbosity,
    )
    resp = await client.post("/v2/extract", body)
    payload = _normalize_extract_response_payload(resp.json())
    return ExtractResponse(**payload)


async def get_extract_status(client: AsyncHttpClient, job_id: str) -> ExtractResponse:
    resp = await client.get(f"/v2/extract/{job_id}")
    payload = _normalize_extract_response_payload(resp.json())
    return ExtractResponse(**payload)


async def wait_extract(
    client: AsyncHttpClient,
    job_id: str,
    *,
    poll_interval: int = 2,
    timeout: Optional[int] = None,
) -> ExtractResponse:
    start_ts = asyncio.get_event_loop().time()
    while True:
        status = await get_extract_status(client, job_id)
        if status.status in ("completed", "failed", "cancelled"):
            return status
        if timeout is not None and (asyncio.get_event_loop().time() - start_ts) > timeout:
            return status
        await asyncio.sleep(max(1, poll_interval))


async def extract(
    client: AsyncHttpClient,
    urls: Optional[List[str]],
    *,
    prompt: Optional[str] = None,
    schema: Optional[Dict[str, Any]] = None,
    system_prompt: Optional[str] = None,
    allow_external_links: Optional[bool] = None,
    enable_web_search: Optional[bool] = None,
    show_sources: Optional[bool] = None,
    scrape_options: Optional[ScrapeOptions] = None,
    ignore_invalid_urls: Optional[bool] = None,
    poll_interval: int = 2,
    timeout: Optional[int] = None,
    integration: Optional[str] = None,
    agent: Optional[AgentOptions] = None,
    limit: Optional[int] = None,
    show_llm_usage: Optional[bool] = None,
    show_cost_tracking: Optional[bool] = None,
    cost_tracking_verbosity: Optional[CostTrackingVerbosity] = None,
) -> ExtractResponse:
    """
    Extract structured data from URLs using LLM (async version).

    Args:
        client: Async HTTP client instance
        urls: List of URLs to extract from (can use wildcards like "https://example.com/*")
        prompt: Natural language prompt describing what to extract
        schema: JSON schema for the expected output structure
        system_prompt: Optional system prompt for the LLM
        allow_external_links: Whether to follow external links
        enable_web_search: Whether to enable web search for finding URLs
        show_sources: Whether to include source information in response
        scrape_options: Options for the underlying scraper
        ignore_invalid_urls: Whether to skip invalid URLs instead of failing
        poll_interval: Seconds between status polls (default: 2)
        timeout: Maximum seconds to wait for completion
        integration: Integration identifier
        agent: Agent options (e.g., for FIRE-1 model)
        limit: Maximum number of pages to scrape
        show_llm_usage: [DEPRECATED] Use show_cost_tracking instead. Whether to include LLM cost in dollars (self-hosted)
        show_cost_tracking: Whether to include cost tracking data (self-hosted)
        cost_tracking_verbosity: Level of detail for cost tracking: "summary", "detailed" (default), or "full"
            - "summary": Only totals (total_calls, total_input_tokens, total_output_tokens, total_cost)
            - "detailed": Totals + per-call breakdown (without stack traces)
            - "full": Everything including stack traces for debugging

    Returns:
        ExtractResponse with extracted data and optional cost tracking info
    """
    started = await start_extract(
        client,
        urls,
        prompt=prompt,
        schema=schema,
        system_prompt=system_prompt,
        allow_external_links=allow_external_links,
        enable_web_search=enable_web_search,
        show_sources=show_sources,
        scrape_options=scrape_options,
        ignore_invalid_urls=ignore_invalid_urls,
        integration=integration,
        agent=agent,
        limit=limit,
        show_llm_usage=show_llm_usage,
        show_cost_tracking=show_cost_tracking,
        cost_tracking_verbosity=cost_tracking_verbosity,
    )
    job_id = getattr(started, "id", None)
    if not job_id:
        return started
    return await wait_extract(client, job_id, poll_interval=poll_interval, timeout=timeout)
