import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { Conversation } from "../models/Conversations";
import { Message } from "../models/Messages";

const router = express.Router();
const upload = multer({ dest: "uploads/" });
const GEMINI_MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
];

const resolvedModelCache = new Map<string, string>();

type ChatRequestBody = {
  text?: string;
  conversationId?: string;
  apiKey?: string;
  preferredModel?: string;
};

function safeDeleteTempFile(filePath?: string) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function getGeminiApiKey(apiKey?: string) {
  const resolvedKey = apiKey?.trim() || process.env.GEMINI_API_KEY;

  if (!resolvedKey) {
    throw new Error(
      "No Gemini API key is configured. Add one in AI Settings or set GEMINI_API_KEY on the server."
    );
  }

  return resolvedKey;
}

function buildModelCandidates(preferredModel?: string, apiKey?: string) {
  const resolvedKey = getGeminiApiKey(apiKey);
  const cachedModel = resolvedModelCache.get(resolvedKey);

  return [preferredModel, cachedModel, ...GEMINI_MODEL_CANDIDATES].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  );
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isUnsupportedModelError(error: unknown) {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("404")
  );
}

async function generateGeminiResponse(
  promptParts: (string | Part)[],
  options: { apiKey?: string; preferredModel?: string }
) {
  const resolvedKey = getGeminiApiKey(options.apiKey);
  const genAI = new GoogleGenerativeAI(resolvedKey);
  const candidates = buildModelCandidates(options.preferredModel, options.apiKey);

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: candidate });
      const result = await model.generateContent(promptParts);
      resolvedModelCache.set(resolvedKey, candidate);

      return {
        text: result.response.text(),
        model: candidate,
      };
    } catch (error) {
      lastError = error;
      if (isUnsupportedModelError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Unable to find a Gemini model that works for this key. Tried: ${candidates.join(", ")}. Last error: ${extractErrorMessage(lastError)}`
  );
}

router.get("/models", isAuthenticated, (_req, res) => {
  res.json({
    models: GEMINI_MODEL_CANDIDATES,
    defaultModel: GEMINI_MODEL_CANDIDATES[0],
  });
});

router.post("/validate-config", isAuthenticated, express.json(), async (req, res) => {
  try {
    const { apiKey, preferredModel } = req.body as ChatRequestBody;
    const result = await generateGeminiResponse(["Reply with only the word OK."], {
      apiKey,
      preferredModel,
    });

    res.json({
      ok: true,
      resolvedModel: result.model,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: extractErrorMessage(error),
    });
  }
});

router.post("/", isAuthenticated, upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;

  try {
    const { text, conversationId, apiKey, preferredModel } = req.body as ChatRequestBody;
    const userId = (req as any).user.ID;
    const promptContent = (text || "").trim();

    if (!promptContent && !file) {
      res.status(400).json({ message: "A prompt or a file is required" });
      return;
    }

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const newConversation = await Conversation.create({
        title: promptContent.substring(0, 50) || file?.originalname || "File Analysis",
        userId,
      });
      currentConversationId = String(newConversation.ID);
    }

    await Message.create({
      conversationId: Number(currentConversationId),
      role: "user",
      content: promptContent || `[Uploaded file] ${file?.originalname || "attachment"}`,
      userId,
    });

    let aiResponse = "";
    let resolvedModel: string | null = null;

    const shouldSummarize =
      /\bsummar(y|ize|ise)\b/i.test(promptContent) || (!promptContent && Boolean(file));

    if (shouldSummarize) {
      const form = new FormData();

      if (file) {
        form.append("file", fs.createReadStream(file.path), file.originalname);
      } else {
        form.append("text", promptContent);
      }

      const summaryResponse = await axios.post("http://localhost:5001/summarize", form, {
        headers: form.getHeaders(),
      });
      aiResponse = summaryResponse.data.final_summary;
      resolvedModel = "combined-summary";
    } else {
      const apiPromptParts: (string | Part)[] = [];

      if (file) {
        apiPromptParts.push({
          inlineData: {
            data: fs.readFileSync(file.path).toString("base64"),
            mimeType: file.mimetype,
          },
        });
      }

      if (promptContent) {
        apiPromptParts.push(promptContent);
      }

      const result = await generateGeminiResponse(apiPromptParts, {
        apiKey,
        preferredModel,
      });
      aiResponse = result.text;
      resolvedModel = result.model;
    }

    await Message.create({
      conversationId: Number(currentConversationId),
      role: "model",
      content: aiResponse,
      userId,
    });

    res.json({
      response: aiResponse,
      conversationId: Number(currentConversationId),
      model: resolvedModel,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      message: extractErrorMessage(error) || "Failed to get response from AI",
    });
  } finally {
    safeDeleteTempFile(file?.path);
  }
});

export default router;
