export type Severity = "Low" | "Medium" | "High" | "Critical";

export interface HazardFinding {
  title: string;
  severity: Severity;
  confidence: number;
  location: string;
  risk: string;
  recommendation: string;
}

export interface HazardAnalysisResult {
  siteSummary: string;
  findings: HazardFinding[];
}
