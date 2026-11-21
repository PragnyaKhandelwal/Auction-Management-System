import { useEffect } from "react";
import { useLocation } from "react-router";

// Credit to the original author of the project Boli is built on. Typing
// author() in the browser console prints it. This replaces an obfuscated
// version of the same signature, which was redefined on every route change.
const AUTHOR_SIGNATURE = [
  "Hidden Signature:",
  "Project by Avnish Kumar",
  "Portfolio: https://theavnishkumar.in",
  "GitHub: https://github.com/theavnishkumar/online-auction-system",
].join("\n");

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.author = () => console.log(AUTHOR_SIGNATURE);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
