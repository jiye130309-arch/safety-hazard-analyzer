import { NextResponse } from "next/server";
import type { HazardAnalysisResult } from "@/types/hazards";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const USE_MOCK_ANALYSIS = process.env.USE_MOCK_ANALYSIS === "true";

const SYSTEM_PROMPT =
  "You are a construction safety auditor. Analyze the image and identify only visible construction safety hazards. " +
  "Return strict JSON with this shape: " +
  '{"siteSummary":"string","findings":[{"title":"string","severity":"Low|Medium|High|Critical","confidence":0-100,"location":"string","risk":"string","recommendation":"string"}]} ' +
  "If no clear hazards are visible, return an empty findings array with a concise siteSummary.";

const MOCK_RESULT: HazardAnalysisResult = {
  siteSummary:
    "Mock analysis mode is enabled. The image appears to show an active construction area with several visible safety compliance concerns that should be reviewed before work continues.",
  findings: [
    {
      title: "Worker at height without visible fall arrest",
      severity: "Critical",
      confidence: 88,
      location: "Upper level near unfinished edge",
      risk: "High risk of severe injury due to potential fall from elevation.",
      recommendation:
        "Require full body harness with approved anchor points and install temporary guardrails."
    },
    {
      title: "Materials stacked unsafely near pathway",
      severity: "High",
      confidence: 84,
      location: "Ground floor access route",
      risk: "Trip and struck-by hazards for workers moving through the area.",
      recommendation:
        "Reorganize storage zones, secure stacked materials, and keep marked walkways clear."
    },
    {
      title: "Incomplete PPE compliance",
      severity: "Medium",
      confidence: 79,
      location: "Central work zone",
      risk: "Increased exposure to head and eye injury from debris or tool impact.",
      recommendation:
        "Enforce PPE checks at entry points and confirm hard hat and eye protection use."
    }
  ]
};

function extractTextOutput(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const possibleText = (payload as { output_text?: unknown }).output_text;
  if (typeof possibleText === "string") {
    return possibleText;
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const piece of content) {
      if (!piece || typeof piece !== "object") {
        continue;
      }

      const text = (piece as { text?: unknown }).text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }

  return "";
}

function parseAndValidateResult(rawText: string): HazardAnalysisResult {
  const parsed = JSON.parse(rawText) as HazardAnalysisResult;

  if (!parsed || typeof parsed.siteSummary !== "string" || !Array.isArray(parsed.findings)) {
    throw new Error("Invalid model response format.");
  }

  return {
    siteSummary: parsed.siteSummary,
    findings: parsed.findings.map((finding) => ({
      title: finding.title,
      severity: finding.severity,
      confidence: Number(finding.confidence),
      location: finding.location,
      risk: finding.risk,
      recommendation: finding.recommendation
    }))
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { imageDataUrl?: string };
    if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }

    if (USE_MOCK_ANALYSIS) {
      return NextResponse.json(MOCK_RESULT);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const openAIResponse = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Analyze this construction site image for safety hazards."
              },
              {
                type: "input_image",
                image_url: body.imageDataUrl
              }
            ]
          }
        ]
      })
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      return NextResponse.json(
        { error: `OpenAI request failed: ${errorText}` },
        { status: openAIResponse.status }
      );
    }

    const rawPayload = (await openAIResponse.json()) as unknown;
    const modelText = extractTextOutput(rawPayload);
    if (!modelText) {
      return NextResponse.json(
        { error: "No analyzable text returned by OpenAI." },
        { status: 502 }
      );
    }

    const result = parseAndValidateResult(modelText);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
