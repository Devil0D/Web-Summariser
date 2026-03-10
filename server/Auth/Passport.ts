import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { handelOAuthUser } from "../helpers/oauthUserHandler";
import { Strategy as FacebookStrategy } from "passport-facebook";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "",
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: any
    ) => {
      try {
        const user = await handelOAuthUser({
          provider: "google",
          providerId: profile.id,
          email: profile.emails?.[0].value,
          username: profile.displayName,
        });
        done(null, user);
      } catch (err: any) {
        done(err as Error, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID || "",
      clientSecret: process.env.FACEBOOK_APP_SECRET || "",
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || "",
      profileFields: ["id", "emails", "name", "displayName"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const username =
          profile.displayName ||
          `${profile.name?.givenName} ${profile.name?.familyName}`;
        const user = await handelOAuthUser({
          provider: "facebook",
          providerId: profile.id,
          email: profile.emails?.[0].value,
          username: profile.displayName,
        });
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.ID);
});
passport.deserializeUser(async (id, done) => {
  try {
    const { User } = await import("../models/Users");
    const user = await User.findByPk(id as number);
    done(null, user);
  } catch (err: any) {
    done(err, null);
  }
});
export default passport;
