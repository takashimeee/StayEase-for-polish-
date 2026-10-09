import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function RequireAuth({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
