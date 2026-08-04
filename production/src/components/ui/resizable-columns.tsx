/**
 * Resizable table columns — drag a full-height divider between any two columns
 * to widen/narrow it so truncated cell text becomes fully visible. Widths persist
 * per device (localStorage). Shared across every data table.
 *
 * Usage:
 *   const { colW, startResize, totalWidth } = useResizableColumns("ros_x_colw", {
 *     name: 200, email: 240, ...
 *   });
 *   <div className="overflow-x-auto">
 *     <div className="relative" style={{ width: totalWidth }}>
 *       <table className="table-fixed w-full">
 *         <colgroup>{ORDER.map(id => <col key={id} style={{ width: colW[id] }} />)}</colgroup>
 *         …thead / tbody…
 *       </table>
 *       <ResizableHandles colW={colW} order={ORDER} startResize={startResize} />
 *     </div>
 *   </div>
 */
"use client";

import * as React from "react";

export function useResizableColumns(storageKey: string, defaults: Record<string, number>) {
  const [colW, setColW] = React.useState<Record<string, number>>(defaults);
  // Mirror of colW so drag handlers read the latest without re-subscribing.
  const colWRef = React.useRef(colW);
  colWRef.current = colW;

  // Load saved widths once (merged over defaults so new columns keep theirs).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setColW((w) => ({ ...w, ...(JSON.parse(raw) as Record<string, number>) }));
    } catch { /* ignore */ }
  }, [storageKey]);

  const startResize = React.useCallback(
    (colId: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = colWRef.current[colId] ?? 150;
      const onMove = (ev: MouseEvent) =>
        setColW((w) => ({ ...w, [colId]: Math.max(60, Math.min(900, startW + ev.clientX - startX)) }));
      const onUp = () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        // Persist only when the drag ends — never clobbers the loaded value.
        try { localStorage.setItem(storageKey, JSON.stringify(colWRef.current)); } catch { /* ignore */ }
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [storageKey],
  );

  const totalWidth = React.useMemo(
    () => Object.values(colW).reduce((a, b) => a + b, 0),
    [colW],
  );

  return { colW, startResize, totalWidth };
}

/**
 * Full-height drag dividers, one at each column boundary (not after the last
 * column). Absolutely positioned inside the table's `relative` wrapper so they
 * span top→bottom and scroll with the table. Each divider resizes the column to
 * its LEFT.
 */
export function ResizableHandles({
  colW,
  order,
  startResize,
}: {
  colW: Record<string, number>;
  order: string[];
  startResize: (id: string) => (e: React.MouseEvent) => void;
}) {
  const bounds: { id: string; x: number }[] = [];
  let acc = 0;
  for (let i = 0; i < order.length - 1; i++) {
    acc += colW[order[i]] ?? 0;
    bounds.push({ id: order[i], x: acc });
  }
  return (
    <>
      {bounds.map((b) => (
        <div
          key={b.id}
          onMouseDown={startResize(b.id)}
          title="Drag to resize this column (full height)"
          className="group absolute top-0 bottom-0 z-20 flex justify-center cursor-col-resize"
          style={{ left: b.x - 6, width: 12 }}
        >
          <span className="h-full w-px bg-hairline-strong/30 group-hover:bg-amber group-hover:w-[2px] group-active:bg-amber group-active:w-[2px] transition-colors" />
        </div>
      ))}
    </>
  );
}
