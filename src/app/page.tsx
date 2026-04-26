"use client";

import { ChangeEvent, useMemo, useState } from "react";
import type { HazardAnalysisResult, HazardFinding } from "@/types/hazards";

const severityStyleMap: Record<HazardFinding["severity"], string> = {
  Low: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
  Medium: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
  High: "bg-orange-500/20 text-orange-200 ring-orange-400/40",
  Critical: "bg-rose-500/20 text-rose-200 ring-rose-400/40"
};

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [analysis, setAnalysis] = useState<HazardAnalysisResult | null>(null);
  const [error, setError] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const findingCountLabel = useMemo(() => {
    if (!analysis) {
      return "";
    }
    const count = analysis.findings.length;
    return `${count} hazard${count === 1 ? "" : "s"} detected`;
  }, [analysis]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    setError("");
    setAnalysis(null);
    const dataUrl = await fileToDataURL(file);
    setPreviewUrl(dataUrl);
  };

  const handleAnalyze = async () => {
    if (!previewUrl) {
      setError("Upload an image before analyzing.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: previewUrl })
      });

      const data = (await response.json()) as HazardAnalysisResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Image analysis failed.");
      }

      setAnalysis(data);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error ? analysisError.message : "Unable to analyze image."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/30 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Construction Site Safety Hazard Analyzer
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
          Upload a construction site image and generate a professional hazard report powered by
          OpenAI GPT-4o vision.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-dashed border-slate-400/40 bg-slate-900/40 p-5">
            <label className="block text-sm font-medium text-slate-200" htmlFor="site-image">
              Upload Image
            </label>
            <input
              id="site-image"
              className="mt-3 block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-700/60"
              type="button"
              onClick={handleAnalyze}
              disabled={!previewUrl || isAnalyzing}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Safety Hazards"}
            </button>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/60">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Uploaded construction site preview"
                className="h-full max-h-80 w-full object-contain"
              />
            ) : (
              <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-slate-400">
                Uploaded image preview will appear here.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/30 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white">Hazard Findings</h2>
          {analysis ? (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
              {findingCountLabel}
            </span>
          ) : null}
        </div>

        {!analysis ? (
          <p className="mt-4 text-sm text-slate-300">
            Run an analysis to generate a structured safety finding list.
          </p>
        ) : (
          <>
            <p className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
              {analysis.siteSummary}
            </p>

            {analysis.findings.length === 0 ? (
              <p className="mt-4 text-sm text-emerald-300">
                No obvious hazards were detected in this image.
              </p>
            ) : (
              <ul className="mt-5 space-y-4">
                {analysis.findings.map((finding, index) => (
                  <li
                    key={`${finding.title}-${index}`}
                    className="rounded-xl border border-slate-700 bg-slate-950/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-lg font-medium text-white">{finding.title}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${severityStyleMap[finding.severity]}`}
                      >
                        {finding.severity} ({Math.max(0, Math.min(100, finding.confidence))}%)
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-slate-400">Location</dt>
                        <dd className="mt-1 text-slate-100">{finding.location}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-slate-400">Risk</dt>
                        <dd className="mt-1 text-slate-100">{finding.risk}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-200">
                      <span className="font-semibold text-slate-100">Recommendation:</span>{" "}
                      {finding.recommendation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
