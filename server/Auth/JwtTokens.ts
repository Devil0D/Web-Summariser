import jwt from "jsonwebtoken";
import { User } from "../models/Users";

interface TokenPlayload {
  ID: number;
  Username: string;
  Email: string;
}
const GenerateToken = (user: User): string => {
  const playload: TokenPlayload = {
    ID: user.ID,
    Username: user.Username,
    Email: user.Email,
  };
  const token = jwt.sign(playload, process.env.JWT_SECRET!, {
    expiresIn: "1d",
  });
  return token;
};

export default GenerateToken;
