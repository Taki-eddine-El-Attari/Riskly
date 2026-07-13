import { motion, type Variants } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.015,
    },
  },
};

const letterAnimation: Variants = {
  hidden: {
    opacity: 0,
    filter: "blur(10px)",
  },
  show: {
    opacity: 1,
    filter: "blur(0px)",
  },
};

export const BlurredStagger = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          variants={letterAnimation}
          transition={{ duration: 0.3 }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </motion.span>
  );
};
