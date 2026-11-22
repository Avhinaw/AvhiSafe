import Link from "next/link";
import React from "react";

const Footer = () => {
  return (
    <section className="mx-auto max-w-screen-2xl border-t px-4 2xl:px-10">
      <div className="flex justify-between py-8">
        <p className="text-primary tracking-tight">
          Designed and Developed by{" "}
          <Link href={"http://avhinaw.netlify.app/"} className="font-bold">
            Abhinav
          </Link>
        </p>
      </div>
    </section>
  );
};

export default Footer;
