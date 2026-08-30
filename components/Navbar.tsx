import { Box } from "lucide-react";
import React from "react";
import { ModeToggle } from "./ui/theme-button";
import { Separator } from "./ui/separator";

const Navbar = () => {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
      <div className="flex items-center gap-2">
        <Box className="size-8" />
        <div className="flex flex-col gap-4">
          <span className="flex items-center gap-2 text-2xl font-extrabold tracking-tighter text-primary sm:text-3xl">
          AvhiSafe{" "}
            <span className="rounded-full text-base bg-primary/10 border border-primary/50 px-2">
              v1.0
            </span>
          </span>
        </div>
      </div>
      <ModeToggle />
    </nav>
  );
};

export default Navbar;
