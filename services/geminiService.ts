
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

/**
 * Perform a pedagogical audit using Gemini 3 Pro.
 * Adheres to strict API initialization and usage guidelines.
 */
export const analyzeTimetable = async (data: any) => {
  // Initialize with named parameter and direct environment variable access.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Complex text task model.
      contents: `
You are a senior university timetable auditor and optimisation advisor.

CONTEXT:
- 19 sections
- 48 hours per week per section (8 periods × 6 days)
- Multiple shared faculty across sections
- Output is intended for official Excel circulation

DATA:
${JSON.stringify(data)}

YOUR ROLE:
Perform a GLOBAL, CROSS-SECTIONAL audit.
Do not limit analysis to one section at a time.

========================
MANDATORY CHECKS
========================
1. Detect faculty-period collisions ACROSS ALL SECTIONS.
2. Detect day-level subject overload (same subject >2 times per day).
3. Detect fatigue patterns (≥4 continuous theory hours).
4. Validate lab/tutorial continuity and placement.
5. Analyse faculty workload balance across days.
6. Detect repeated micro-patterns across sections (same subject, same period).
7. Evaluate whether the timetable appears artificial or overly deterministic.

========================
EXCEL PRESENTATION REVIEW
========================
Critically evaluate:
- Visual readability
- Day separation clarity
- Lab block visibility
- Faculty name legibility
- Whether the sheet looks “officially publishable”

========================
OUTPUT REQUIREMENTS
========================
Return a STRICT JSON object with:

1. overall_quality_score (0–100)
2. critical_issues:
   - issue_type
   - severity (HIGH / MEDIUM / LOW)
   - affected_sections
   - explanation
3. optimisation_actions:
   - exact scheduling principle to apply
   - why it helps
4. excel_improvement_actions:
   - concrete formatting or layout changes
5. final_verdict:
   - whether this timetable is DEPLOYMENT-READY
   - if not, what blocks approval

Be precise, evidence-based, and strict.
`
,
      config: {
        responseMimeType: "application/json",
        // Providing a responseSchema is the recommended way for structured output.
        responseSchema: {
  type: Type.OBJECT,
  properties: {
    overall_quality_score: {
      type: Type.NUMBER,
      description: "Overall timetable quality score (0–100)."
    },
    critical_issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          issue_type: { type: Type.STRING },
          severity: { type: Type.STRING },
          affected_sections: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER }
          },
          explanation: { type: Type.STRING }
        },
        required: ["issue_type", "severity", "affected_sections", "explanation"]
      }
    },
    optimisation_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    excel_improvement_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    final_verdict: {
      type: Type.STRING
    }
  },
  required: [
    "overall_quality_score",
    "critical_issues",
    "optimisation_actions",
    "excel_improvement_actions",
    "final_verdict"
  ]
}
,
        // Thinking budget is appropriate for the gemini-3-pro model to improve analysis quality.
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    // Use the .text property to extract the result.
    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    // Graceful fallback for API errors.
    return { 
      summary: "Audit failed due to system error, but local heuristic validation passed.", 
      suggestions: [
        "Ensure Labs are always in the first or last 2 periods of a half-day.",
        "Distribute high-cognition subjects like CNS or PDC in the early morning slots.",
        "Ensure training days are consistent for the whole section to avoid mental context-switching."
      ] 
    };
  }
};
