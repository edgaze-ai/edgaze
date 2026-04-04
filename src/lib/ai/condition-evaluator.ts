// AI-powered condition evaluator — all condition nodes use this path (gpt-4o-mini).

export interface ConditionEvaluationResult {
  result: boolean;
  confidence?: number;
  reasoning?: string;
}

/**
 * Build the natural-language instruction sent to the model from inspector operator
 * (truthy, equals, …), optional compare value, and optional humanCondition text.
 */
export function buildConditionEvaluationInstruction(params: {
  operator: string;
  compareValue: unknown;
  humanCondition?: string;
}): string {
  const op = params.operator || "truthy";
  const cv =
    params.compareValue === undefined || params.compareValue === null
      ? ""
      : String(params.compareValue);
  const humanRaw = typeof params.humanCondition === "string" ? params.humanCondition.trim() : "";

  const modeBlocks: Record<string, string> = {
    truthy:
      "TRUTHY mode: answer true if the input is logically true or present—substantive non-empty content, affirmative answers, or meaningful structured data. Answer false for null, missing data, empty strings, explicit false, clear negation, or no substantive content.",
    falsy:
      'FALSY mode: answer true if the input is logically false or empty (null, undefined, empty text, zero meaning none, explicit false, clear "no", or lack of substantive content). Answer false when the input is clearly present and affirmative.',
    equals: `EQUALS mode: answer true only if the input is equal to the reference value ${JSON.stringify(
      cv,
    )} (normalize strings; for objects, use meaningful equality).`,
    notEquals: `NOT EQUALS mode: answer true only if the input is not equal to the reference value ${JSON.stringify(
      cv,
    )}.`,
    gt: `GREATER THAN mode: answer true only if the input can be interpreted as a number strictly greater than ${cv}.`,
    lt: `LESS THAN mode: answer true only if the input can be interpreted as a number strictly less than ${cv}.`,
  };

  const mode =
    modeBlocks[op] ??
    modeBlocks.truthy ??
    "TRUTHY mode: answer true when the input is clearly present and substantively true.";

  if (humanRaw) {
    return `${humanRaw}\n\nApply this using the following rule (your final boolean must follow it): ${mode}`;
  }
  return mode;
}

/**
 * Evaluate a condition instruction using AI (cheap model).
 */
export async function evaluateConditionWithAI(
  condition: string,
  inputValue: unknown,
  apiKey: string,
): Promise<ConditionEvaluationResult> {
  try {
    // Convert input value to a readable string
    let inputDescription = "";
    if (inputValue === null || inputValue === undefined) {
      inputDescription = "null or undefined";
    } else if (typeof inputValue === "string") {
      inputDescription = `"${inputValue}"`;
    } else if (typeof inputValue === "number") {
      inputDescription = String(inputValue);
    } else if (typeof inputValue === "boolean") {
      inputDescription = String(inputValue);
    } else if (Array.isArray(inputValue)) {
      inputDescription = `an array with ${inputValue.length} items`;
    } else if (typeof inputValue === "object") {
      try {
        inputDescription = JSON.stringify(inputValue);
      } catch {
        inputDescription = "an object";
      }
    } else {
      inputDescription = String(inputValue);
    }

    const prompt = `You are a condition evaluator. Evaluate whether the following condition is true or false based on the provided input value.

Condition / rule: "${condition}"

Input value: ${inputDescription}

Respond with ONLY a JSON object in this exact format:
{
  "result": true or false,
  "confidence": a number between 0 and 1,
  "reasoning": "brief explanation"
}

Be strict and logical. If the condition is ambiguous or cannot be evaluated, return false with low confidence.`;

    // Call OpenAI API with the cheapest model
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cheapest model
        messages: [
          {
            role: "system",
            content: "You are a precise condition evaluator. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 200, // Keep it short and cheap
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`AI evaluation failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr.trim());

      return {
        result: Boolean(parsed.result),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback: try to extract true/false from the response
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes("true") && !lowerContent.includes("false")) {
        return { result: true, confidence: 0.3 };
      }
      if (lowerContent.includes("false") && !lowerContent.includes("true")) {
        return { result: false, confidence: 0.3 };
      }
      throw new Error("Could not parse AI evaluation result");
    }
  } catch (err: unknown) {
    console.error("Error evaluating condition with AI:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
