import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware";
import { Folder } from "../models/Folders";

const router = express.Router();
router.use(express.json());
router.use(isAuthenticated);

router.get("/", async (req, res) => {
  const userID = (req as any).user.ID;
  const folders = await Folder.findAll({ where: { User_ID: userID } });
  res.json(folders);
});

router.post("/", async (req, res) => {
  const userID = (req as any).user.ID;
  const { name } = req.body;
  const newFolder = await Folder.create({
    Folder_Name: name || "Untilted_Folder",
    User_ID: userID,
  });
  res.status(201).json(newFolder);
});

router.delete("/:id", async (req, res) => {
  const userId = (req as any).user.ID;
  const folderId = req.params.id;

  try {
    const result = await Folder.destroy({
      where: {
        ID: folderId,
        User_ID: userId,
      },
    });
    if (result === 0) {
      res.status(404).json({ message: "Folder not found" });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Failed to delete folder", error);
    res.status(500).json({ message: "Failed to delete folder" });
  }
});

export default router;
