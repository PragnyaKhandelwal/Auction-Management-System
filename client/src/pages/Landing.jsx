import { useSelector } from "react-redux";
import { CTA } from "../components/Landing/CTA";
import { Features } from "../components/Landing/Features";
import { Hero } from "../components/Landing/Hero";
import Dashboard from "./Dashboard";
import LoadingScreen from "../components/LoadingScreen";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export const Landing = () => {
  const { user, loading } = useSelector((state) => state.auth);
  useDocumentTitle(user ? "Dashboard" : "Home");

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen">
      {!user && (
        <>
          <Hero />
          <Features />
          <CTA />
        </>
      )}
      {user && <Dashboard />}
    </div>
  );
};
