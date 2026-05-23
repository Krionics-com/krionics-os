import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

type Params = { params: Promise<{ id: string }> };

function calculateCost(model: string, input: number, output: number): number {
  // Cost in micro-dollars ($0.000001 units)
  const m = model.toLowerCase();
  if (m.includes("haiku")) {
    return Math.round(input * 0.25 + output * 1.25);
  } else if (m.includes("opus")) {
    return Math.round(input * 15.0 + output * 75.0);
  } else {
    // Default to Sonnet pricing
    return Math.round(input * 3.0 + output * 15.0);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { variables = {} } = body;

  // 1. Fetch prompt details
  const [prompt] = await sql<any[]>`
    SELECT * FROM ai_prompts WHERE id = ${id}
  `;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  // 2. Render prompt
  const userTemplate = prompt.user_template || "";
  const renderedPrompt = userTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, key: string) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
  });

  const startTime = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === "mock_key" || apiKey === "") {
    // Local dev fallback if Anthropic key is not present
    const latency = Math.round(300 + Math.random() * 500);
    const mockInputTokens = renderedPrompt.length / 4 + 50;
    const mockResponseText = `[MOCK AI RESPONSE (No ANTHROPIC_API_KEY found)]\n\nProcessed variables:\n${JSON.stringify(variables, null, 2)}\n\nThis is a mock draft generated using ${prompt.model}. Prompt length: ${renderedPrompt.length} characters.`;
    const mockOutputTokens = mockResponseText.length / 4;
    const costMicro = calculateCost(prompt.model, mockInputTokens, mockOutputTokens);

    try {
      await sql`
        INSERT INTO ai_invocations (
          client_id, prompt_id, prompt_version, invocation_type,
          trace_id, entity_type, model, input_tokens, output_tokens,
          latency_ms, success, cost_usd_micro, raw_output, invoked_at
        ) VALUES (
          ${prompt.client_id || null},
          ${prompt.id},
          ${prompt.version},
          ${prompt.invocation_type},
          gen_random_uuid(),
          'reply',
          ${prompt.model},
          ${Math.round(mockInputTokens)},
          ${Math.round(mockOutputTokens)},
          ${latency},
          true,
          ${costMicro},
          ${JSON.stringify({ response: mockResponseText })}::jsonb,
          NOW()
        )
      `;
    } catch (dbErr: any) {
      console.error("Failed to insert mock invocation log:", dbErr);
    }

    return NextResponse.json({
      response: mockResponseText,
      input_tokens: Math.round(mockInputTokens),
      output_tokens: Math.round(mockOutputTokens),
      latency_ms: latency,
    });
  }

  // Real Anthropic invocation
  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: prompt.model || "claude-3-5-sonnet-20241022",
      max_tokens: prompt.max_tokens || 1024,
      temperature: parseFloat(prompt.temperature) || 0.3,
      system: prompt.system_prompt || undefined,
      messages: [{ role: "user", content: renderedPrompt }],
    });

    const latency = Date.now() - startTime;
    const responseText = response.content[0]?.type === "text" ? response.content[0].text : "";
    const inputTokens = response.usage.input_tokens || 0;
    const outputTokens = response.usage.output_tokens || 0;
    const costMicro = calculateCost(prompt.model, inputTokens, outputTokens);

    // Save invocation log to DB
    await sql`
      INSERT INTO ai_invocations (
        client_id, prompt_id, prompt_version, invocation_type,
        trace_id, entity_type, model, input_tokens, output_tokens,
        latency_ms, success, cost_usd_micro, raw_output, invoked_at
      ) VALUES (
        ${prompt.client_id || null},
        ${prompt.id},
        ${prompt.version},
        ${prompt.invocation_type},
        gen_random_uuid(),
        'reply',
        ${prompt.model},
        ${inputTokens},
        ${outputTokens},
        ${latency},
        true,
        ${costMicro},
        ${JSON.stringify({ response: responseText })}::jsonb,
        NOW()
      )
    `;

    return NextResponse.json({
      response: responseText,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latency,
    });
  } catch (err: any) {
    console.error("AI prompt test run failed:", err);
    const latency = Date.now() - startTime;

    try {
      await sql`
        INSERT INTO ai_invocations (
          client_id, prompt_id, prompt_version, invocation_type,
          trace_id, entity_type, model, success, error_code, latency_ms, invoked_at
        ) VALUES (
          ${prompt.client_id || null},
          ${prompt.id},
          ${prompt.version},
          ${prompt.invocation_type},
          gen_random_uuid(),
          'reply',
          ${prompt.model},
          false,
          ${err.message || "Unknown error"},
          ${latency},
          NOW()
        )
      `;
    } catch (dbErr) {
      console.error("Failed to insert error invocation log:", dbErr);
    }

    return NextResponse.json({ error: err.message || "Failed to execute prompt" }, { status: 500 });
  }
}
