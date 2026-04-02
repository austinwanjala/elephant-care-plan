import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

if (import.meta.env.PROD || !isLocalhost) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
}

createRoot(document.getElementById("root")!).render(<App />);
