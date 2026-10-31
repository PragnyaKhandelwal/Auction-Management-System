import React from "react";
import { Link } from "react-router";

export const CTA = () => {
  return (
    <section className="bg-amber-400 py-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h2 className="text-3xl font-semibold text-gray-900">
          Got something worth bidding on?
        </h2>
        <Link
          to="/signup"
          className="inline-flex items-center justify-center bg-gray-900 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-gray-800 transition-all shrink-0"
        >
          List your first item
        </Link>
      </div>
    </section>
  );
};
