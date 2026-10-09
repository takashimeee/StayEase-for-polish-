import { useLayoutEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useApp } from "../context/AppContext";
import { Alert } from "./ui";

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleButton({ onSuccess, text = "continue_with" }) {
  const { loginWithGoogle } = useApp();
  const [error, setError] = useState("");
  const [width, setWidth] = useState(320);
  const box = useRef(null);

  // Match the primary button width (Google allows 200–400px)
  useLayoutEffect(() => {
    if (box.current) setWidth(Math.max(200, Math.min(400, Math.round(box.current.offsetWidth))));
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <Alert tone="info" icon={false} className="text-xs leading-relaxed">
        Google login isn't set up yet. Add <code>VITE_GOOGLE_CLIENT_ID=your-client-id</code> to a{" "}
        <code>.env</code> file and restart the dev server.
      </Alert>
    );
  }

  const handleSuccess = async (response) => {
    const res = await loginWithGoogle(response.credential);
    if (!res.ok) return setError(res.error);
    onSuccess();
    return undefined;
  };

  return (
    <div ref={box} className="flex w-full flex-col items-center gap-2">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => setError("Google sign-in failed. Please try again.")}
        text={text}
        shape="rectangular"
        width={String(width)}
      />
      {error && (
        <small role="alert" className="text-xs text-red-600">
          {error}
        </small>
      )}
    </div>
  );
}