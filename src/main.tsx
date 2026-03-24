import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyBrandFavicon } from "@/lib/branding";

applyBrandFavicon();

createRoot(document.getElementById("root")!).render(<App />);
