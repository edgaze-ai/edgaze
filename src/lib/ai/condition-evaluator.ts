// AI-powered condition evaluator for human-readable conditions
// Uses a cheap AI model (gpt-4o-mini) to evaluate natural language conditions

export interface ConditionEvaluationResult {
  result: boolean;
  confidence?: number;
  reasoning?: string;
}

/**
 * Evaluate a human-readable condition using AI
 * Example: "The user's age is greater than 18" -> true/false
 */
export async function evaluateConditionWithAI(
  condition: string,
  inputValue: unknown,
  apiKey: string
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

    // Build the prompt for the AI
    const prompt = `You are a condition evaluator. Evaluate whether the following condition is true or false based on the provided input value.

Condition: "${condition}"

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
            content:
              "You are a precise condition evaluator. Always respond with valid JSON only.",
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
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
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
  } catch (err: any) {
    console.error("Error evaluating condition with AI:", err);
    // Fallback to simple truthy check
    return {
      result: Boolean(inputValue),
      confidence: 0.1,
      reasoning: "AI evaluation failed, using fallback",
    };
  }
}
