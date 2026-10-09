import { Navigate, Route, Routes } from "react-router-dom";
import ScrollToHash from "./components/ScrollToHash";
import RequireAuth from "./components/RequireAuth";
import { useApp } from "./context/AppContext";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Rooms from "./pages/Rooms";
import RoomDetails from "./pages/RoomDetails";
import Booking from "./pages/Booking";
import BookingReview from "./pages/BookingReview";
import Payment from "./pages/Payment";
import Confirmation from "./pages/Confirmation";
import MyReservations from "./pages/MyReservations";
import Profile from "./pages/Profile";
import LegalPage from "./pages/LegalPage";
import Menu from "./pages/Menu";
import NotFound from "./pages/NotFound";
import RequireRole from "./components/RequireRole";
import Dashboard from "./pages/admin/Dashboard";
import RoomManagement from "./pages/admin/RoomManagement";
import Analytics from "./pages/admin/Analytics";
import Housekeeping from "./pages/admin/Housekeeping";
import Reservations from "./pages/admin/Reservations";
import Settings from "./pages/admin/Settings";

// "/" shows the landing page to visitors and sends logged-in users to their home.
function RootRoute() {
  const { user } = useApp();
  return user ? <Navigate to="/home" replace /> : <LandingPage />;
}

// "/home" is the member home; visitors are sent to the landing page instead.
function MemberHome() {
  const { user } = useApp();
  if (!user) return <Navigate to="/" replace />;
  if (user.role && user.role !== "guest") return <Navigate to="/admin/dashboard" replace />;
  return <Home />;
}

export default function App() {
  return (
    <>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/home" element={<MemberHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomDetails />} />
        <Route path="/menu" element={<Menu />} />
        <Route
          path="/booking"
          element={
            <RequireAuth>
              <Booking />
            </RequireAuth>
          }
        />
        <Route
          path="/booking/review"
          element={
            <RequireAuth>
              <BookingReview />
            </RequireAuth>
          }
        />
        <Route
          path="/booking/payment"
          element={
            <RequireAuth>
              <Payment />
            </RequireAuth>
          }
        />
        <Route
          path="/booking/confirmation/:id"
          element={
            <RequireAuth>
              <Confirmation />
            </RequireAuth>
          }
        />
        <Route
          path="/my-reservations"
          element={
            <RequireAuth>
              <MyReservations />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<RequireRole roles={["admin"]}><Dashboard /></RequireRole>} />
        <Route path="/admin/rooms" element={<RequireRole roles={["admin"]}><RoomManagement /></RequireRole>} />
        <Route path="/admin/analytics" element={<RequireRole roles={["admin"]}><Analytics /></RequireRole>} />
        <Route path="/admin/housekeeping" element={<RequireRole roles={["admin"]}><Housekeeping /></RequireRole>} />
        <Route path="/admin/reservations" element={<RequireRole roles={["admin"]}><Reservations /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole roles={["admin"]}><Settings /></RequireRole>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}