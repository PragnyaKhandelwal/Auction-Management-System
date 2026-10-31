import { Link } from "react-router";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FORMATS } from "../utils/auction";

export const About = () => {
  useDocumentTitle("About");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">About Boli</h1>
        <p className="text-lg text-gray-600 leading-relaxed mb-10">
          Boli (बोली) means &quot;bid&quot; in Hindi. Most auction sites sell
          everything one way. Boli lets the seller choose the format that suits
          the item.
        </p>

        <div className="space-y-4">
          {Object.entries(FORMATS).map(([key, f]) => (
            <section
              key={key}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {f.label}
              </h2>
              <p className="text-sm font-medium text-gray-500 mb-2">
                {f.tagline}
              </p>
              <p className="text-gray-600 leading-relaxed">{f.rules}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-gray-500">
          Built on an open-source, MIT-licensed MERN auction project. Questions?{" "}
          <Link
            to="/contact"
            className="text-brand-600 hover:text-brand-800 underline font-medium"
          >
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
};
