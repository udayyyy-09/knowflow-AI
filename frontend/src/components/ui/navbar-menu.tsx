"use client";
import React from "react";
import { motion } from "motion/react";

const transition = {
  type: "spring" as const,
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export const MenuItem = ({
  setActive,
  active,
  item,
  children,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  children?: React.ReactNode;
}) => {
  return (
    <div onMouseEnter={() => setActive(item)} className="relative">
      <motion.p
        transition={{ duration: 0.3 }}
        className="cursor-pointer text-xs uppercase tracking-wider font-semibold text-[#1B1F27] hover:text-[#2E6F5E] transition-colors py-1"
      >
        {item}
      </motion.p>
      {active !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
        >
          {active === item && (
            <div className="absolute top-[calc(100%_+_1rem)] left-1/2 transform -translate-x-1/2 pt-2">
              <motion.div
                transition={transition}
                layoutId="active"
                className="bg-[#FDFCFA] rounded-2xl overflow-hidden border border-[#DDD9CC] shadow-xl"
              >
                <motion.div
                  layout
                  className="w-max h-full p-4"
                >
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export const Menu = ({
  setActive,
  children,
}: {
  setActive: (item: string | null) => void;
  children: React.ReactNode;
}) => {
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className="relative rounded-full border border-[#DDD9CC] bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center space-x-6 px-6 py-2.5"
    >
      {children}
    </nav>
  );
};

export const ProductItem = ({
  title,
  description,
  href,
  src,
}: {
  title: string;
  description: string;
  href: string;
  src: string;
}) => {
  return (
    <a href={href} className="flex space-x-3.5 group p-2 rounded-xl hover:bg-[#F6F5F0] transition-colors">
      <img
        src={src}
        width={130}
        height={75}
        alt={title}
        className="shrink-0 rounded-lg shadow-sm border border-[#DDD9CC] object-cover w-[130px] h-[75px] group-hover:border-[#1B1F27]/30 transition-all"
      />
      <div className="flex flex-col justify-center">
        <h4 className="text-sm font-bold text-[#1B1F27] group-hover:text-[#2E6F5E] transition-colors">
          {title}
        </h4>
        <p className="text-[#5B6270] text-xs leading-relaxed max-w-[12rem] mt-0.5">
          {description}
        </p>
      </div>
    </a>
  );
};

export const HoveredLink = ({ children, className = '', ...rest }: any) => {
  return (
    <a
      {...rest}
      className={`block p-2 rounded-xl text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#F6F5F0] transition-all ${className}`}
    >
      {children}
    </a>
  );
};
