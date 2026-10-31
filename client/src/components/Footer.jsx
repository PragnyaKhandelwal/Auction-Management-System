import { Link } from "react-router";

export const Footer = () => {
  return (
      <footer className="bg-brand-950 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0 text-center md:text-left">
              <h3 className="text-xl font-semibold text-white font-display">
                Boli
              </h3>
              <p className="text-brand-200 text-sm">
                English, Dutch and sealed-bid auctions
              </p>
            </div>
            <div className="flex space-x-6">
              <Link
                to="/about"
                className="text-brand-200 hover:text-white text-sm transition-colors"
              >
                About
              </Link>
              <Link
                to="/legal"
                className="text-brand-200 hover:text-white text-sm transition-colors"
              >
                Legal
              </Link>
              <Link
                to="/contact"
                className="text-brand-200 hover:text-white text-sm transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
  );
};
