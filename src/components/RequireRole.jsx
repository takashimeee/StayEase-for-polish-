import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function RequireRole({ roles, children }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/home" replace />;
  return children;
}