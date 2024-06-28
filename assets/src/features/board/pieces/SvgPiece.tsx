import { motion } from "framer-motion";
import { pieces } from "./pieces";
import { useState } from "react";
import { tv } from "tailwind-variants";
import { useTranslation } from "react-i18next";

const recipe = tv({
  base: "relative z-0 cursor-grab touch-none outline-none",
  variants: {
    dragging: {
      true: "z-50",
    },
  },
});

export function SvgPiece(props: Readonly<{ piece: string | null }>) {
  const info = pieces.get(props.piece);
  const { t } = useTranslation();

  const [isDragging, setIsDragging] = useState(false);

  const className = recipe({
    dragging: isDragging,
  });

  if (!info) {
    return null;
  }

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      drag
      dragConstraints={{
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }}
      onDragStart={() => setIsDragging(true)}
      onDragTransitionEnd={() => setIsDragging(false)}
      whileHover={{ scale: 1.1 }}
      dragElastic={1}
      dragTransition={{
        bounceStiffness: 1000,
        bounceDamping: 50,
      }}
      className={className}
      viewBox="0 0 45 45"
      pointerEvents="none">
      <title>{t(info.title)}</title>
      {info.Element}
    </motion.svg>
  );
}
