import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import LabApp from "./lab/LabApp.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).has("lab") ? <LabApp /> : <App />}
  </StrictMode>,
);
