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
const port = Number(process.env.PORT) || 5000;
const allowStartWithoutDb = process.env.ALLOW_START_WITHOUT_DB === "true";

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

sequelize
  .sync({})
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed.");
    console.error("Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS in server/.env");
    console.error(error);

    if (allowStartWithoutDb) {
      console.warn("ALLOW_START_WITHOUT_DB=true, starting server without DB sync.");
      app.listen(port, () => {
        console.log(`Server running on port ${port} (without database)`);
      });
      return;
    }

    process.exit(1);
  });