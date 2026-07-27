import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TelegramCallback from "./pages/TelegramCallback";

function Placeholder({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-text-faint">{title} · bientôt</p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/telegram/callback" element={<TelegramCallback />} />
      <Route path="/forgot-password" element={<Placeholder title="/forgot-password" />} />
      <Route path="/app" element={<Placeholder title="/app" />} />
      <Route path="/history" element={<Placeholder title="/history" />} />
    </Routes>
  );
}
