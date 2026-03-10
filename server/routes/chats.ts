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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-pro" })

router.post("/", isAuthenticated, upload.single("file"), (async (req, res): Promise<void> => {
  try {
    const { text, conversationId } = req.body;
    const file = req.file;
    const userId = (req as any).user.ID;
    const promptContent = text || "";

    if (!promptContent && !file) {
      res.status(400).json({ message: "A prompt or a file is required" });
      return 
    }

    // --- Database Logic: Create conversation and save user message ---
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const newConversation = await Conversation.create({
        title: promptContent.substring(0, 50) || "File Analysis",
        userId: userId,
      });
      currentConversationId = newConversation.ID;
    }

    await Message.create({
      conversationId: currentConversationId,
      role: "user",
      content: promptContent,
      userId: userId,
    });

    let aiResponse = "";

    // --- Corrected AI Routing Logic ---
    if (promptContent.toLowerCase().includes("summarize")) {
      console.log("Routing to Python summarization service...");
      const form = new FormData();
      
      // Add text or file to the form for the Python service
      if (file) {
        form.append('file', fs.createReadStream(file.path), file.originalname);
      } else {
        form.append('text', promptContent);
      }

      const summaryResponse = await axios.post(
        "http://localhost:5001/summarize",
        form,
        { headers: form.getHeaders() }
      );
      aiResponse = summaryResponse.data.final_summary;

    } else {
      // --- Gemini API Logic ---
      console.log("Routing to Gemini API...");
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
      const result = await model.generateContent(apiPromptParts);
      aiResponse = result.response.text();
    }
    
    // Clean up the temporary file if one existed, AFTER it has been used
    if (file) {
      fs.unlinkSync(file.path);
    }

    // --- Save AI message and send response ---
    await Message.create({
      conversationId: currentConversationId,
      role: "model",
      content: aiResponse,
      userId: userId,
    });
    res.json({ response: aiResponse, conversationId: currentConversationId });

  } catch (error: any) {
    console.error("API Error:", error);
    // Clean up file on error as well
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: "Failed to get response from AI" });
  }
}))

export default router;
