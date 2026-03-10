import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { User } from "../models/Users";
import GenerateToken from "../Auth/JwtTokens";
import upload from "../middleware/upload";
import { isAuthenticated } from "../middleware/authMiddleware";

const router = express.Router();
router.use(express.json());
//Public Route
//Signup
router.post(
  "/signup",
  async (req: Request, res: Response, next: NextFunction) => {
    const { Username, Email, Password } = req.body;

    try {
      if (!Username || !Email || !Password) {
        res.status(400).json({ message: "All fields are required" });
        return;
      }
      const hash = await bcrypt.hash(Password, 10);
      const user = await User.create({
        Username: Username,
        Email: Email,
        Password: hash,
        tokens: "",
      });
      res.status(201).json({
        user: { id: user.ID, Username: user.Username, Email: user.Email },
      });
    } catch (err: any) {
      console.log("Signup Failed", err);

      next(err);
    }
  }
);

//Login

const loginHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { Email, Password } = req.body;
    const user = await User.findOne({ where: { Email } });
    if (!user) {
      res.status(401).json({ message: "Invalid credentails" });
      return;
    }
    const valid = await bcrypt.compare(Password, user.Password); //Comparing passwrod
    if (!valid) {
      res.status(401).json({ message: "Invalid credentails" });
      return;
    }

    const token = GenerateToken(user);

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({
        message: "Login Sucessful",
        user: { id: user.ID, Username: user.Username, Email: user.Email },
      });
  } catch (err: any) {
    next(err);
  }
};
router.post("/login", loginHandler);

//Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "consent",
  })
);

//google callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = GenerateToken(user);
    console.log("jwt token", token);

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .redirect(`http://localhost:5173/dashboard`);
  }
);

//facebook OAuth
router.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"], prompt: "consent" })
);

//facebook callback
router.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: "/login",
    session: false,
  }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      const token = GenerateToken(user);
      console.log("jwt token", token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 24 * 60 * 60 * 1000,
        })
        .redirect(`http://localhost:5173/dashboard`);
    } catch (err: any) {
      next(err);
    }
  }
);

//Middleware barrier [Everything below are protected]

router.use(isAuthenticated);

//Protected Route

router.get("/check-auth", (req: Request, res: Response) => {
  // If the request reaches here, the middleware has already confirmed
  // the user is authenticated.
  res.status(200).json({
    isAuthenticated: true,
    user: (req as any).user, // The user data is attached by the middleware
  });
});

//logout
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout succesfull" });
});

//upload
router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).send("No file uploaded");
    return;
  }
  res.status(200).json({});
});

export default router;
