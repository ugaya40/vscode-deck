import {
  Play,
  Package,
  Sparkles,
  FlaskConical,
  FileCheck,
  Eye,
  Rocket,
  Trash2,
  Wand2,
  DatabaseZap,
  Terminal,
  Bug,
  Download,
  Upload,
  RefreshCw,
  Hammer,
  Copy,
  Server,
  Check,
  Zap,
  Clock,
  Lock,
  Book,
  GitBranch,
  GitCommit,
  GitMerge,
  FolderOpen,
  Send,
  Archive,
  Container,
  Square,
  ScrollText,
  Search,
  Globe,
  Wifi,
  Settings,
  Code,
} from "lucide-static";

const iconMap: Record<string, string> = {
  Play,
  Package,
  Sparkles,
  FlaskConical,
  FileCheck,
  Eye,
  Rocket,
  Trash2,
  Wand2,
  DatabaseZap,
  Terminal,
  Bug,
  Download,
  Upload,
  RefreshCw,
  Hammer,
  Copy,
  Server,
  Check,
  Zap,
  Clock,
  Lock,
  Book,
  GitBranch,
  GitCommit,
  GitMerge,
  FolderOpen,
  Send,
  Archive,
  Container,
  Square,
  ScrollText,
  Search,
  Globe,
  Wifi,
  Settings,
  Code,
};

interface ScriptStyle {
  pattern: RegExp;
  iconSvg: string;
  color: string;
}

const scriptStyles: ScriptStyle[] = [
  { pattern: /build|compile|bundle/, iconSvg: Package, color: "#3B82F6" },
  { pattern: /dev|start|serve|watch/, iconSvg: Play, color: "#22C55E" },
  { pattern: /lint|format|prettier/, iconSvg: Sparkles, color: "#8B5CF6" },
  { pattern: /test/, iconSvg: FlaskConical, color: "#EAB308" },
  { pattern: /typecheck|tsc/, iconSvg: FileCheck, color: "#06B6D4" },
  { pattern: /preview|storybook/, iconSvg: Eye, color: "#EC4899" },
  { pattern: /deploy|release|publish/, iconSvg: Rocket, color: "#F97316" },
  { pattern: /clean|reset/, iconSvg: Trash2, color: "#EF4444" },
  { pattern: /generate|codegen/, iconSvg: Wand2, color: "#A855F7" },
  { pattern: /migrate|seed/, iconSvg: DatabaseZap, color: "#14B8A6" },
];

const defaultStyle: Omit<ScriptStyle, "pattern"> = {
  iconSvg: Terminal,
  color: "#6B7280",
};

function extractPathsFromSvg(svgString: string): string {
  const pathMatches = svgString.match(/<(path|circle|rect|line|polyline|polygon|ellipse)[^>]*\/>/g);
  return pathMatches ? pathMatches.join("\n") : "";
}

function getStyleForScript(scriptName: string): Omit<ScriptStyle, "pattern"> {
  for (const style of scriptStyles) {
    if (style.pattern.test(scriptName)) {
      return style;
    }
  }
  return defaultStyle;
}

export function getIconPathsForScript(scriptName: string): string {
  return extractPathsFromSvg(getStyleForScript(scriptName).iconSvg);
}

export function getIconPathsByName(iconName: string): string | undefined {
  const svg = iconMap[iconName];
  if (!svg) return undefined;
  return extractPathsFromSvg(svg);
}

export function getColorForScript(scriptName: string): string {
  return getStyleForScript(scriptName).color;
}
