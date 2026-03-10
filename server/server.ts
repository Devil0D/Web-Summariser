import express from "express";
import cors from "cors";
import { sequelize } from "./database";
import authRoutes from "./routes/auth";
import folderRoutes from "./routes/folder";
import chatRoutes from "./routes/chats";
import conversationsRoutes from "./routes/conversation";
import * as dotenv from "dotenv";
import session from "express-session";
import passport from "../server/Auth/Passport";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());
app.use(
  session({
    secret: "some-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,       // set to true if using https
      sameSite: "lax",     // helps with cross-origin cookies
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// All routes are mounted here
app.use("/websears/auth", authRoutes);
app.use("/websears/folders", folderRoutes);
app.use("/websears/chat", chatRoutes);
app.use("/websears/conversations", conversationsRoutes);

sequelize.sync({}).then(() => {
  app.listen(5000, () => {
    console.log(`Server running on port 5000`);
  });
});