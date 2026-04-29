import { useEffect, useState } from "react";

export function useTerminalSize() {
  const getSize = () => ({ columns: process.stdout.columns || 100, rows: process.stdout.rows || 32 });
  const [size, setSize] = useState(getSize);
  useEffect(() => {
    const onResize = () => setSize(getSize());
    process.stdout.on("resize", onResize);
    return () => process.stdout.off("resize", onResize);
  }, []);
  return size;
}

export function paneWidths(columns) {
  const sidebar = Math.max(28, Math.floor(columns * 0.25));
  const main = Math.max(50, columns - sidebar - 1);
  return { main, sidebar };
}
