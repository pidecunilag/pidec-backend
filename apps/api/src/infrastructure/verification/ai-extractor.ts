import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../../shared/logger/index.js';

export interface ExtractionResult {
  name: string | null;
  matricNumber: string | null;
  department: string | null;
  confidence: 'high' | 'low';
}

const SYSTEM_PROMPT = `You are a document extraction assistant.
Extract the student's full name, matric number, and department from the provided exam docket or course registration form.
Return ONLY a JSON object with this exact structure:
{
  "name": "extracted name or null",
  "matricNumber": "extracted matric number or null",
  "department": "extracted department or null",
  "confidence": "high" or "low"
}
Set confidence to "low" if the image is blurry, details are unreadable, or you are unsure. Otherwise, set to "high".`;

// Groq deprecated the older Llama 3.2 vision preview models.
// Keep this overridable so we can react quickly to future model lifecycle changes.
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

const GROQ_BASE64_IMAGE_LIMIT_BYTES = 4 * 1024 * 1024;

function parseExtractionJson(content: string): ExtractionResult | null {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const json = start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;
  const parsed = JSON.parse(json) as Partial<ExtractionResult>;

  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null,
    matricNumber:
      typeof parsed.matricNumber === 'string' && parsed.matricNumber.trim()
        ? parsed.matricNumber.trim()
        : null,
    department:
      typeof parsed.department === 'string' && parsed.department.trim()
        ? parsed.department.trim()
        : null,
    confidence: parsed.confidence === 'low' ? 'low' : 'high',
  };
}

export async function extractWithGroq(
  buffer: Buffer,
  mimeType: string,
  prompt = SYSTEM_PROMPT,
): Promise<ExtractionResult | null> {
  try {
    if (!process.env.GROQ_API_KEY) return null;

    const base64Image = buffer.toString('base64');
    if (base64Image.length > GROQ_BASE64_IMAGE_LIMIT_BYTES) {
      logger.warn(
        { mimeType, size: buffer.length },
        'Skipping Groq extraction because base64 payload exceeds the vision request limit',
      );
      return null;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await groq.chat.completions.create({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return parseExtractionJson(content);
  } catch (err) {
    logger.error({ err }, 'Groq extraction failed');
    return null;
  }
}

export async function extractWithGemini(
  buffer: Buffer,
  mimeType: string,
  prompt = SYSTEM_PROMPT,
): Promise<ExtractionResult | null> {
  try {
    if (!process.env.GEMINI_API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const base64Image = buffer.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType } }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const content = response.text;
    if (!content) return null;

    return parseExtractionJson(content);
  } catch (err) {
    logger.error({ err }, 'Gemini extraction failed');
    return null;
  }
}
