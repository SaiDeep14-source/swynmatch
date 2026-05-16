import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

const cleanEnvValue = (val: string | undefined) => {
  if (!val) return "";
  return val.trim().replace(/^["'](.*)["']$/, '$1').trim();
};

const key = cleanEnvValue(process.env.GEMINI_API_KEY);
console.log("key length:", key.length, "key format valid?", /^AIzaSy/.test(key));

const ai = new GoogleGenAI({ apiKey: key });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'hello',
    });
    console.log(response.text);
  } catch (e: any) {
    console.error(e);
  }
}

run();
