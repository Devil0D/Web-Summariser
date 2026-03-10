import { User } from "../models/Users";

export const handelOAuthUser = async ({
  provider,
  providerId,
  email,
  username,
}: {
  provider: "google" | "facebook";
  providerId: string;
  email?: string;
  username?: string;
}) => {
  const field = provider === "google" ? "google_id" : "facebook_id";
  const whereClause = { [field]: providerId };
  try {
    const fallbackEmail = email || `${provider}_${providerId}@gmail.com`;
    const fallbackUsername = username || `${provider}_user_${Math.floor(Math.random() * 10000)}`;
    const [user] = await User.findOrCreate({
      where: whereClause,
      defaults: {
        Email: email || "" || fallbackEmail,
        Username: username || `${provider}_user` || fallbackUsername,
        Password: "",
        tokens: "",
      },
    });
    return user;
  } catch (err: any) {
    console.log("Failed to create or find OAuth user", err);
    if (err.orignal) console.log("Orignal DB error", err.orignal.sqlMessage);
    throw err;
  }
};
