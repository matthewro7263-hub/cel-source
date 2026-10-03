import { Link } from "wouter";
import { motion } from "framer-motion";
import { Film, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full text-center"
      >
        {/* Subtle film strip motif */}
        <div className="mx-auto mb-8 flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-white border border-[#EDE9E3] flex items-center justify-center shadow-sm">
              <Film className="w-10 h-10 text-[#6E4FE8]" strokeWidth={1.5} />
            </div>
            {/* Perforation dots */}
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#EDE9E3] rounded-full" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#EDE9E3] rounded-full" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-[#EDE9E3] rounded-full" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#EDE9E3] rounded-full" />
          </div>
        </div>

        <h1 className="text-5xl font-semibold tracking-[-1.5px] text-[#15140F] mb-3">
          Frame not found
        </h1>
        
        <p className="text-lg text-[#4A463F] mb-8 leading-relaxed">
          The page or reel you're looking for doesn't exist, has been moved, or the link is broken.
          <br className="hidden sm:block" />
          No worries — let's get you back to creating.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#15140F] text-white font-medium hover:bg-black transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#D1CDC6] text-[#15140F] font-medium hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Home
          </Link>
        </div>

        <p className="mt-10 text-xs text-[#7A756C]">
          If you arrived here from a shared link, it may have expired.
        </p>
      </motion.div>
    </div>
  );
}
