import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { SCHEMA_GENERATION_PROMPT } from "@/lib/ai/prompts";
import type { GeneratedSchema } from "@/lib/types/schema";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: SCHEMA_GENERATION_PROMPT,
      prompt: `Create a form schema for: ${prompt}`,
      temperature: 0.7,
      maxTokens: 4000,
    });

    // Parse and validate JSON
    let schema: GeneratedSchema;
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      schema = JSON.parse(cleanedText);
    } catch {
      console.error("Failed to parse schema JSON:", text);
      return NextResponse.json(
        { error: "Failed to parse generated schema. Please try again." },
        { status: 500 }
      );
    }

    // Basic validation
    if (!schema.name || !schema.fields || typeof schema.fields !== "object") {
      return NextResponse.json(
        { error: "Invalid schema structure. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ schema });
  } catch (error) {
    console.error("Schema generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate schema. Please check your API key and try again." },
      { status: 500 }
    );
  }
}
