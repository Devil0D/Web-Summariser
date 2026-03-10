import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/header/api";

type AuthMode = "login" | "signup";
export function AuthForm(mode: AuthMode) {
  //state delecrations store update data

  const [Email, setEmail] = useState("");
  const { setUser } = useAuth();
  const [Password, setPassword] = useState("");
  const [Username, setUsername] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  //Handel submit for login and signup

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode == "signup") {
        await api.post("/auth/signup", { Email, Password, Username });
        navigate("/login");
      } else {
        const response = await api.post("/auth/login", { Email, Password });
        if (response.data.user) {
          setUser(response.data.user);
        }
        navigate("/Dashboard");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (mode === "signup"
            ? "Signup failed check the details"
            : "Login Failed check credentails ")
      );
    } finally {
      setLoading(false);
    }
  };

  // Redirects the user to Google OAuth login.

  const loginWithgoogle = async () => {
    window.location.href = import.meta.env.VITE_OAUTH_URL;
  };

  const loginWithfacebook = async () => {
    window.location.href = import.meta.env.VITE_FACEBOOK_URL;
  };

  return {
    Email,
    setEmail,
    Password,
    setPassword,
    Username,
    setUsername,
    error,
    loading,
    handleSubmit,
    loginWithgoogle,
    loginWithfacebook,
  };
}
