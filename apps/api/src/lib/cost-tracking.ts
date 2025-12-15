export class CostLimitExceededError extends Error {
  constructor() {
    super("Cost limit exceeded");
    this.message = "Cost limit exceeded";
    this.name = "CostLimitExceededError";
  }
}

const nanProof = (n: number | null | undefined) =>
  isNaN(n ?? 0) ? 0 : (n ?? 0);

export type CostTrackingVerbosity = "summary" | "detailed" | "full";

export type CostTrackingCall = {
  metadata: Record<string, any>;
  cost: number;
  model: string;
  tokens?: {
    input: number;
    output: number;
  };
  stack?: string;
};

export type CostTrackingSummary = {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
};

export type CostTrackingDetailed = CostTrackingSummary & {
  calls: Omit<CostTrackingCall, "stack">[];
};

export type CostTrackingFull = CostTrackingSummary & {
  calls: CostTrackingCall[];
};

export type CostTrackingOutput = CostTrackingSummary | CostTrackingDetailed | CostTrackingFull;

export class CostTracking {
  calls: (CostTrackingCall & { stack: string })[] = [];
  limit: number | null = null;

  constructor(limit: number | null = null) {
    this.limit = limit;
  }

  public addCall(call: Omit<CostTrackingCall, "stack">) {
    this.calls.push({
      ...call,
      stack: new Error().stack!.split("\n").slice(2).join("\n"),
    });

    if (this.limit !== null && this.getSummary().totalCost > this.limit) {
      throw new CostLimitExceededError();
    }
  }

  private getSummary(): CostTrackingSummary {
    return {
      totalCalls: this.calls.length,
      totalInputTokens: this.calls.reduce(
        (acc, c) => acc + nanProof(c.tokens?.input),
        0,
      ),
      totalOutputTokens: this.calls.reduce(
        (acc, c) => acc + nanProof(c.tokens?.output),
        0,
      ),
      totalCost: this.calls.reduce((acc, c) => acc + nanProof(c.cost), 0),
    };
  }

  public toJSON(verbosity: CostTrackingVerbosity = "full"): CostTrackingOutput {
    const summary = this.getSummary();

    if (verbosity === "summary") {
      return summary;
    }

    if (verbosity === "detailed") {
      return {
        ...summary,
        calls: this.calls.map(({ stack, ...rest }) => rest),
      };
    }

    // "full" - include everything
    return {
      ...summary,
      calls: this.calls,
    };
  }
}
