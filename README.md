# Construction Safety Hazard Analyzer

A modern Next.js + Tailwind CSS web app that allows users to upload a construction site image and run safety hazard analysis with the OpenAI GPT-4o API.

## Features

- Image upload with instant preview
- GPT-4o vision analysis of construction site hazards
- Structured, professional findings list:
  - Hazard title
  - Severity and confidence
  - Location and risk description
  - Recommended mitigation action

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Set your OpenAI API key in `.env.local`:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## API Route

- Endpoint: `POST /api/analyze`
- Input payload:

  ```json
  {
    "imageDataUrl": "data:image/jpeg;base64,..."
  }
  ```

- Output payload:

  ```json
  {
    "siteSummary": "General site safety summary...",
    "findings": [
      {
        "title": "Missing fall protection at edge",
        "severity": "High",
        "confidence": 91,
        "location": "Upper slab edge near scaffolding",
        "risk": "Potential fall from height causing severe injury.",
        "recommendation": "Install guardrails and enforce harness usage immediately."
      }
    ]
  }
  ```
