import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

import { BrowserRouter } from "react-router-dom";

// Initialize theme from localStorage
const theme = localStorage.getItem("theme") || "light";
const colorScheme = localStorage.getItem("colorScheme") || "default";

if (theme === "dark") {
  document.documentElement.classList.add("dark");
}
document.documentElement.setAttribute("data-color-scheme", colorScheme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
