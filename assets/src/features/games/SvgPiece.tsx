import { Piece, SquareIndex } from "@/types";
import { motion } from "framer-motion";
import { usePiece } from "./pieces/usePiece";
import { useState } from "react";
import { clsx } from "clsx";

export function SvgPiece(props: Readonly<{ squareIndex: SquareIndex; piece: Piece }>) {
  const info = usePiece(props.piece);
  const [isDragging, setIsDragging] = useState(false);

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
      className={clsx("relative z-0 cursor-grab touch-none outline-none", { "z-50": isDragging })}
      viewBox="0 0 45 45"
      pointerEvents="none">
      <title>{info.title}</title>
      {info.Element}
    </motion.svg>
  );
}
