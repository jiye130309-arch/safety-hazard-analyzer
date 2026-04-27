import { NextResponse } from "next/server";
import type { HazardAnalysisResult } from "@/types/hazards";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const USE_MOCK_ANALYSIS = process.env.USE_MOCK_ANALYSIS === "true";
const INVALID_IMAGE_MESSAGE =
  "No valid construction site image detected. Please upload a clear photo of the site for analysis.";

const SYSTEM_PROMPT =
  "You are a construction safety auditor. First determine if the provided file is a valid construction site image or construction-site document photo/PDF. " +
  "If the file is not a construction site, or is blank/missing/unclear, return strict JSON: " +
  `{"isValidConstructionSite":false,"siteSummary":"${INVALID_IMAGE_MESSAGE}","findings":[]}. ` +
  "If valid, return strict JSON: " +
  '{"isValidConstructionSite":true,"siteSummary":"string","findings":[{"title":"string","severity":"Low|Medium|High|Critical","confidence":0-100,"location":"string","risk":"string","recommendation":"string"}]}. ' +
  "Do not invent hazards when the image is invalid.";

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildMockResult(fileName: string, fileMimeType: string, fileDataUrl: string): HazardAnalysisResult {
  const hash = simpleHash(`${fileName}:${fileMimeType}:${fileDataUrl.slice(0, 250)}`);
  const summaries = [
    "Potential edge-protection and housekeeping concerns are visible and should be reviewed immediately.",
    "Site conditions suggest moderate compliance gaps around access safety and equipment handling.",
    "Several visible conditions indicate elevated risk areas requiring targeted mitigation controls."
  ];

  const hazardTemplates: HazardAnalysisResult["findings"] = [
    {
      title: "Inadequate edge protection",
      severity: "High",
      confidence: 84,
      location: "Elevated work perimeter",
      risk: "Workers may be exposed to fall-from-height incidents.",
      recommendation: "Install temporary guardrails and verify fall-arrest equipment usage."
    },
    {
      title: "Poor material housekeeping",
      severity: "Medium",
      confidence: 79,
      location: "Primary access pathway",
      risk: "Loose materials can create slip/trip hazards and obstruct evacuation routes.",
      recommendation: "Clear walkways and enforce designated storage zones."
    },
    {
      title: "Incomplete PPE compliance",
      severity: "Medium",
      confidence: 76,
      location: "Active work zone",
      risk: "Insufficient PPE raises likelihood of head/eye injury.",
      recommendation: "Enforce PPE checks at entry points and supervisory spot audits."
    },
    {
      title: "Uncontrolled lifting zone",
      severity: "Critical",
      confidence: 81,
      location: "Near material handling area",
      risk: "Dropped loads or swing radius intrusion can cause severe injury.",
      recommendation: "Establish exclusion barriers and assign a banksman/spotter."
    }
  ];

  const findingsCount = (hash % 3) + 1;
  const offset = hash % hazardTemplates.length;
  const findings = Array.from({ length: findingsCount }, (_, index) => {
    return hazardTemplates[(offset + index) % hazardTemplates.length];
  });

  return {
    siteSummary: `[Mock mode] ${summaries[hash % summaries.length]} (${fileName || fileMimeType})`,
    findings
  };
}

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
  const parsed = JSON.parse(rawText) as {
    isValidConstructionSite?: boolean;
    siteSummary?: string;
    findings?: HazardAnalysisResult["findings"];
  };

  if (!parsed || typeof parsed.siteSummary !== "string" || !Array.isArray(parsed.findings)) {
    throw new Error("Invalid model response format.");
  }

  if (parsed.isValidConstructionSite === false) {
    return {
      siteSummary: INVALID_IMAGE_MESSAGE,
      findings: []
    };
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
    const body = (await request.json()) as {
      fileDataUrl?: string;
      fileMimeType?: string;
      fileName?: string;
    };
    if (!body.fileDataUrl || typeof body.fileDataUrl !== "string") {
      return NextResponse.json({
        siteSummary: INVALID_IMAGE_MESSAGE,
        findings: []
      });
    }

    const fileMimeType = body.fileMimeType || "";
    const isSupportedType =
      fileMimeType.startsWith("image/") || fileMimeType === "application/pdf";
    if (!isSupportedType) {
      return NextResponse.json({
        siteSummary: INVALID_IMAGE_MESSAGE,
        findings: []
      });
    }

    if (USE_MOCK_ANALYSIS) {
      return NextResponse.json(
        buildMockResult(body.fileName || "uploaded-file", fileMimeType, body.fileDataUrl)
      );
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
                text:
                  "Analyze this uploaded file for construction-site safety hazards. " +
                  "If this is not a construction site, return the invalid response exactly as instructed."
              },
              ...(fileMimeType === "application/pdf"
                ? [
                    {
                      type: "input_file",
                      filename: body.fileName || "uploaded-site-file.pdf",
                      file_data: body.fileDataUrl
                    }
                  ]
                : [
                    {
                      type: "input_image",
                      image_url: body.fileDataUrl
                    }
                  ])
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
