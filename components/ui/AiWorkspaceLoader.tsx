import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";

import { useEffect, useState } from "react";

export function AiWorkspaceLoader() {
  const messages = [
    "Authenticating session",
    "Syncing wallets",
    "Loading workspace",
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setI((prev) => (prev + 1) % messages.length);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="mt-12 flex flex-col items-center gap-4 bg-background p-10 text-center">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="flex size-12 items-center justify-center rounded-xl border border-primary/10 bg-primary/[0.04]"
      >
        <Lock className="size-5 text-primary/60" />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.p
          key={messages[i]}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-primary/60"
        >
          {messages[i]}
        </motion.p>
      </AnimatePresence>

      <div className="h-1 w-40 overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className="h-full w-1/3 rounded-full bg-primary/50"
          animate={{ x: ["-100%", "220%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </section>
  );
}