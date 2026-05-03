import { useEffect, useState } from "react";

export function useTerminalSize() {
  const getSize = () => ({ columns: process.stdout.columns || 100, rows: process.stdout.rows || 32 });
  const [size, setSize] = useState(getSize);
  useEffect(() => {
    const onResize = () => setSize(getSize);
    process.stdout.on("resize", onResize);
    return () => process.stdout.off("resize", onResize);
  }, []);
  return size;
}

export function paneWidths(columns) {
  const safeColumns = Math.max(20, Number(columns) || 100);
  if (safeColumns < 80) return { main: safeColumns, sidebar: 0, showSidebar: false };
  const sidebar = Math.max(28, Math.floor(safeColumns * 0.25));
  const main = Math.max(50, safeColumns - sidebar - 1);
  return { main, sidebar, showSidebar: true };
}
