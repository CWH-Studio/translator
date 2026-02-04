// functions/api/dictionary-lookup.ts

interface Env {
  AI: any;
}

const SYSTEM_PROMPT_TEMPLATE = (
  text: string,
) => `You are an expert multilingual dictionary. Your task is to take a word or phrase, "${text}", and provide comprehensive details for it and its translations in English, Malay, and Chinese.

Follow these instructions precisely:
1.  **Detect Language**: First, identify the language of the input "${text}". It must be one of English, Malay, or Chinese.
2.  **Translate**: Provide translations for the other two languages. You must return a total of three items: the original word and its two translations.
3.  **Provide Details for Each Word (Original and Translations)**: For each of the three items, you MUST provide the following fields:
    *   \`language\`: The language of the word. MUST be one of: "English", "Malay", or "Chinese". **Do NOT use "Mandarin", "Simplified Chinese", or "Bahasa". Use EXACTLY "Chinese" or "Malay".**
    *   \`word\`: The word or phrase itself. This is MANDATORY.
    *   \`explanation\`: A clear and concise explanation of the word's meaning and usage. **The explanation MUST be in the same language as the 'language' field.** For example, if the language is "Chinese", the explanation must be in Chinese. This is MANDATORY.
    *   \`example\`: A simple example sentence demonstrating how the word is used. This is MANDATORY.
    *   \`pinyin\`: If the language is "Chinese", you MUST provide the Hanyu Pinyin. If the language is NOT "Chinese", you MUST OMIT this field entirely.
4.  **Format Output**: Return a single, valid JSON object. The JSON object must strictly adhere to the following structure:
    {
      "sourceLanguage": "English", // or "Malay" or "Chinese"
      "translations": [
        {
          "language": "English",
          "word": "Apple",
          "explanation": "A round fruit with red or green skin and a white inside.",
          "example": "I ate an apple for lunch."
        },
        {
          "language": "Malay",
          "word": "Epal",
          "explanation": "Sejenis buah bulat yang mempunyai kulit merah atau hijau dan isi putih.",
          "example": "Saya makan sebiji epal untuk makan tengah hari."
        },
        {
          "language": "Chinese",
          "word": "苹果",
          "explanation": "一种圆形的落叶乔木果实，通常为红色、绿色或黄色。",
          "example": "我午餐吃了一个苹果。",
          "pinyin": "píng guǒ"
        }
      ]
    }
    Do not include any text or markdown formatting outside of the JSON object. ONLY return the JSON object.`;

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`);
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Call Cloudflare AI
async function callCloudflareAI(
  env: Env,
  text: string,
  systemPrompt: string,
): Promise<string> {
  const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze the word: "${text}"` },
    ],
  });

  let responseText = "";
  if (
    typeof response === "object" &&
    response !== null &&
    "response" in response
  ) {
    responseText = (response as any).response;
  } else if (typeof response === "string") {
    responseText = response;
  } else {
    responseText = JSON.stringify(response);
  }

  if (!responseText || responseText.trim() === "") {
    throw new Error("Empty response from Cloudflare AI");
  }

  return responseText;
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  try {
    const { text } = (await context.request.json()) as { text: string };

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text input" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE(text);
    
    // Call Cloudflare AI with 5 retries and exponential backoff
    const responseText = await retryWithBackoff(
      () => callCloudflareAI(context.env, text, systemPrompt),
      5,    // max 5 retries
      1000, // 1s base delay (1s, 2s, 4s, 8s, 16s)
    );
    
    console.log("Cloudflare AI succeeded");
    console.log("AI response text:", responseText.substring(0, 300));

    // Clean up response text (sometimes models add markdown code blocks)
    let cleanedResponse = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonResponse = JSON.parse(cleanedResponse);

    // Validate structure
    if (
      !jsonResponse.sourceLanguage ||
      !Array.isArray(jsonResponse.translations)
    ) {
      throw new Error("Invalid data structure from AI model");
    }

    // Helper to normalize language names
    const normalizeLanguage = (lang: string): string | null => {
      if (!lang) return null;
      const lower = lang.toLowerCase().trim();
      if (["english", "en", "en-us"].includes(lower)) return "English";
      if (["malay", "ms", "bahasa", "bahasa melayu"].includes(lower))
        return "Malay";
      if (
        [
          "chinese",
          "zh",
          "zh-cn",
          "mandarin",
          "simplified chinese",
          "traditional chinese",
        ].includes(lower)
      )
        return "Chinese";
      return null; // Invalid language
    };

    const sanitizedTranslations = jsonResponse.translations
      .map((t: any) => {
        if (!t) return null;
        const normalizedLang = normalizeLanguage(t.language);
        if (!normalizedLang) return null;

        return {
          ...t,
          language: normalizedLang, // Use the normalized name
        };
      })
      .filter((t: any) => {
        if (!t) return false;
        const { language, word, explanation, example } = t;
        return (
          typeof language === "string" &&
          typeof word === "string" &&
          word.trim() !== "" &&
          typeof explanation === "string" &&
          explanation.trim() !== "" &&
          typeof example === "string" &&
          example.trim() !== ""
        );
      });

    const sanitizedResponse = {
      sourceLanguage:
        normalizeLanguage(jsonResponse.sourceLanguage) || "English",
      translations: sanitizedTranslations,
    };

    return new Response(JSON.stringify(sanitizedResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({
        error: "Dictionary lookup failed",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
