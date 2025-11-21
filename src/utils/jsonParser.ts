/**
 * Utility functions for parsing JSON from agent outputs
 * Handles cases where JSON might be wrapped in markdown code blocks or have extra text
 */

export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  rawOutput?: string;
}

/**
 * Extract and parse JSON from agent output
 * Handles:
 * - Pure JSON
 * - JSON wrapped in markdown code blocks (```json ... ```)
 * - JSON with leading/trailing text
 */
export function parseJsonOutput<T = any>(output: string): ParseResult<T> {
  if (!output || output.trim().length === 0) {
    return {
      success: false,
      data: null,
      error: 'Empty output',
      rawOutput: output,
    };
  }

  const trimmed = output.trim();

  // Try 1: Parse entire output as JSON
  try {
    const parsed = JSON.parse(trimmed);
    return {
      success: true,
      data: parsed,
      rawOutput: output,
    };
  } catch (e) {
    // Continue to other methods
  }

  // Try 2: Extract JSON from markdown code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      return {
        success: true,
        data: parsed,
        rawOutput: output,
      };
    } catch (e) {
      // Continue
    }
  }

  // Try 3: Find first { ... } block
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonString = trimmed.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonString);
      return {
        success: true,
        data: parsed,
        rawOutput: output,
      };
    } catch (e) {
      // Continue
    }
  }

  // Try 4: Find first [ ... ] block (for arrays)
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const jsonString = trimmed.slice(firstBracket, lastBracket + 1);
      const parsed = JSON.parse(jsonString);
      return {
        success: true,
        data: parsed,
        rawOutput: output,
      };
    } catch (e) {
      // Continue
    }
  }

  return {
    success: false,
    data: null,
    error: 'No valid JSON found in output',
    rawOutput: output,
  };
}

/**
 * Extract text content from JSON response (for display purposes)
 */
export function extractTextFromJson(json: any): string {
  if (typeof json === 'string') {
    return json;
  }
  
  if (json && typeof json === 'object') {
    // Try common fields
    if (json.response) return json.response;
    if (json.content) return json.content;
    if (json.text) return json.text;
    if (json.message) return json.message;
    if (json.output) return json.output;
    
    // If it's an array, try to extract text from items
    if (Array.isArray(json)) {
      return json.map(item => extractTextFromJson(item)).join('\n\n');
    }
    
    // Fallback: stringify
    return JSON.stringify(json, null, 2);
  }
  
  return String(json);
}

