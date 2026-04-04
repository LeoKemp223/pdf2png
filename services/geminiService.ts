
import { GoogleGenAI, Type } from "@google/genai";
import { WatermarkDetectionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function detectWatermark(imageBase64: string): Promise<WatermarkDetectionResult> {
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    Analyze the provided image, which is a crop of the bottom-right 40% of a PDF slide.
    1. Identify the exact bounding box (x, y, width, height) of the watermark, logo, or page number branding.
    2. Coordinates must be integers 0-100 relative to this crop.
    3. Determine the HEX background color specifically in the area surrounding the watermark. This is crucial for "seamless" restoration.
    4. Provide a high-confidence bounding box that covers the entire watermark area without cutting off edges.
    Return JSON only.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          width: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          backgroundColor: { type: Type.STRING, description: "The sampled hex color of the background (e.g. #F5F5F5)" },
          description: { type: Type.STRING }
        },
        required: ["x", "y", "width", "height", "backgroundColor"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text || '{}');
    return result as WatermarkDetectionResult;
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("Could not detect watermark. Please try another file or ensure it has a visible watermark in the bottom-right.");
  }
}
