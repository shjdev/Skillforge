import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
for (const model of ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']) {
  try {
    const r = await ai.models.generateContent({ model, contents: 'Dis ok' });
    console.log(model, 'OK', r.text.slice(0, 20));
  } catch (e) { console.log(model, 'ERR', String(e.message).replace(/\s+/g,' ').match(/Quota exceeded for metric[^,]*,[^,]*,[^.]*|"code":\d+/g)); }
}
