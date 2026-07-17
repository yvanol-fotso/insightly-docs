import Groq from "groq-sdk";
import { callGroqWithLimit } from "./groqLimiter";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function askLLM(
  question: string,
  context: string,
  history: Message[] = []
): Promise<string> {
  const completion = await callGroqWithLimit(
    () =>
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Tu es un assistant qui repond aux questions en te basant UNIQUEMENT sur le contexte fourni. Si la réponse n'est pas dans le contexte, dis-le clairement. Tu peux aussi t'appuyer sur l'historique de la conversation pour comprendre les questions de suivi (ex: 'et pour la deuxième partie ?').",
          },
          ...history,
          {
            role: "user",
            content: `Contexte :\n${context}\n\nQuestion : ${question}`,
          },
        ],
        temperature: 0.3,
      }),
    "génération de réponse chat"
  );

  return completion.choices[0]?.message?.content ?? "Pas de réponse générée.";
}