import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware";
import { Conversation } from "../models/Conversations";
import { Message } from "../models/Messages";
``;

const router = express.Router();
router.use(isAuthenticated);

router.get("/", async (req, res) => {
  const userId = (req as any).user.ID;
  const conversations = await Conversation.findAll({
    where: { userId },
    order: [["updatedAt", "DESC"]],
  });
  res.json(conversations);
});

router.get("/:id", async (req, res) => {
  const userId = (req as any).user.ID;
  const conversationId = req.params.id;
  const messages = await Message.findAll({
    where: { conversationId, userId: userId },
    order: [["createdAt", "ASC"]],
  });
  res.json(messages);
});

router.delete("/:id", async (req, res) => {
  const userId = (req as any).user.ID;
  const conversationId = req.params.id;

  try {
    const result = await Conversation.destroy({
      where: {
        ID: conversationId,
        userId: userId,
      },
    });
    if (result == 0) {
      res.status(400).json({
        message: "Conversation not found or you do not have permission",
      });
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: "Failed to delete conversation" });
  }
});
export default router;
