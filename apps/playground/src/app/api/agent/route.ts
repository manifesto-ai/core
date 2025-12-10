import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

const AGENT_SYSTEM_PROMPT = `You are an AI agent that helps users interact with a form.

You can perform these actions:
1. SET_VALUE: Set a form field value
2. INFO: Provide information or answer questions about the form

Current form schema and data will be provided in the user message.

You must respond with ONLY valid JSON in this format:
{
  "action": "SET_VALUE|INFO",
  "payload": {
    // For SET_VALUE:
    "path": "data.fieldName",
    "value": "the value to set"

    // For INFO: no payload needed
  },
  "explanation": "A friendly explanation of what you did or the information requested"
}

Guidelines:
- For SET_VALUE, use the exact field name from the schema
- You can set multiple fields by making multiple SET_VALUE requests
- Always be helpful and explain what you're doing
- If the user asks to modify the form structure, explain that they need to go back and create a new form with the desired changes
- If you can't do something, explain why in the explanation field`;

export async function POST(request: Request) {
  try {
    const { message, schema, formData } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const contextMessage = `
Current Form Schema:
${JSON.stringify(schema, null, 2)}

Current Form Data:
${JSON.stringify(formData, null, 2)}

User Request: ${message}
`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: AGENT_SYSTEM_PROMPT,
      prompt: contextMessage,
      temperature: 0.5,
      maxTokens: 4000,
    });

    // Parse the response
    let result;
    try {
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      result = JSON.parse(cleanedText);
    } catch {
      // If parsing fails, return as INFO with the raw text as explanation
      result = {
        action: "INFO",
        explanation: text,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(
      {
        action: "INFO",
        explanation: "Sorry, I encountered an error processing your request. Please try again."
      },
      { status: 500 }
    );
  }
}
