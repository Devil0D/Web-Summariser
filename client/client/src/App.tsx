import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/login"; //Import Login Pages
import SignupPage from "./pages/Signup"; //Import Signup Pages
import Dashboard from "./pages/Dashboard"; //Import Dashboard pages
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectRoute";
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
