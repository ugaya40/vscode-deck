import type { Disposable } from "vscode";

export type SlotStatus = "idle" | "running";

export type TaskResult = "success" | "error" | "canceled";

export interface SlotData {
  scriptId: string;
  svg: string;
  status: SlotStatus;
}

export interface CreateSlotSvgOptions {
  iconPaths?: string;
  lines: string[];
  color?: string;
  textColor?: string;
  iconGlow?: boolean;
  textAlign?: "center" | "left";
}

function createGlowFilter(): string {
  return `<defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;
}

export function createSlotSvg(options: CreateSlotSvgOptions): string {
  const { iconPaths, lines, color, textColor = "#FFFFFF", iconGlow = false, textAlign = "center" } = options;
  const lineCount = Math.min(lines.length, 3);
  const backgroundRect = color ? `<rect width="144" height="144" fill="${color}"/>` : "";
  const glowFilter = iconGlow ? createGlowFilter() : "";
  const iconFilterAttr = iconGlow ? ' filter="url(#glow)"' : "";
  const textX = textAlign === "left" ? 12 : 72;
  const textAnchor = textAlign === "left" ? "start" : "middle";

  if (iconPaths) {
    const iconSlotHeight = 144 / (1 + lineCount);
    const iconSize = iconSlotHeight * 0.9;
    const iconY = iconSlotHeight / 2;

    const textAreaTop = iconSlotHeight;
    const textAreaHeight = 144 - iconSlotHeight;
    const fontSize = Math.min(28, textAreaHeight / lineCount * 0.7);
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lineCount * lineHeight;
    const textStartY = textAreaTop + (textAreaHeight - totalTextHeight) / 2 + fontSize * 0.8;

    const textElements = lines.slice(0, 3).map((line, index) => {
      const y = textStartY + index * lineHeight;
      const escapedLine = escapeXml(line);
      return `<text x="${textX}" y="${y}" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="${textAnchor}">${escapedLine}</text>`;
    });

    const iconScale = iconSize / 24;
    const iconOffsetX = (144 - iconSize) / 2;
    const iconOffsetY = iconY - iconSize / 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  ${glowFilter}
  ${backgroundRect}
  <g${iconFilterAttr} transform="translate(${iconOffsetX}, ${iconOffsetY}) scale(${iconScale})" stroke="${textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${iconPaths}
  </g>
  ${textElements.join("\n  ")}
</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  const fontSizes = [28, 27, 26];
  const fontSize = fontSizes[lineCount - 1];
  const lineHeight = fontSize * 1.3;
  const totalHeight = lineCount * lineHeight;
  const startY = (144 - totalHeight) / 2 + fontSize * 0.8;

  const textElements = lines.slice(0, 3).map((line, index) => {
    const y = startY + index * lineHeight;
    const escapedLine = escapeXml(line);
    return `<text x="${textX}" y="${y}" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="${textAnchor}">${escapedLine}</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  ${backgroundRect}
  ${textElements.join("\n  ")}
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface RunResult {
  success: boolean;
  message?: string;
  taskId?: string;
}

export interface CancelResult {
  success: boolean;
  message?: string;
}

export interface TaskCompleteEvent {
  scriptId: string;
  result: TaskResult;
}

export interface ProviderNotifiers {
  notifyChange(): void;
  notifyTaskComplete(event: TaskCompleteEvent): void;
}

export interface SlotProvider {
  id: string;
  isActive(): boolean;
  getSlots(): SlotData[];
  run(scriptId: string): Promise<RunResult>;
  cancel?(scriptId: string): Promise<CancelResult>;
}

export interface SlotProviderFactoryResult {
  provider: SlotProvider;
  disposables: Disposable[];
}

export type SlotProviderFactory = (notifiers: ProviderNotifiers) => Promise<SlotProviderFactoryResult>;

export interface StreamDeckHostAPI {
  registerProvider(factory: SlotProviderFactory): Promise<Disposable>;
}
