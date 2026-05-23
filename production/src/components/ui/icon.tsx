/**
 * Icon — thin wrapper around lucide-react with prototype's icon name compatibility.
 *
 * Use the same names as the prototype (e.g., "arrow_right", "check_circle")
 * for easy porting. They map to lucide icons internally.
 *
 * @example
 * <Icon name="arrow_right" size={16} />
 * <Icon name="rupee" className="text-emerald" />
 */
import {
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight,
  Home, Inbox, Target, Users, User, FileText, Receipt, RefreshCw,
  Clock, Package, Zap, Bell, Search, Plus, Check, CheckCircle2,
  X, XCircle, AlertTriangle, Info, Mail, Phone, MessageSquare,
  Settings, BarChart3, PieChart, Layout, Shield, Globe, Download,
  Upload, Filter, MoreHorizontal, MoreVertical, Edit, Trash2, Copy,
  Link, ExternalLink, Calendar, Star, Bolt, GripVertical, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Play, Lock, LogOut, Sparkles,
  IndianRupee, ShoppingCart, Award, Database, Layers, PaintBucket,
  Rocket, HelpCircle, Ticket, BookOpen, Smile, TrendingUp, TrendingDown,
  Smartphone, Sun, Moon, Building2, Briefcase, SlidersHorizontal,
  List, Grid3x3, Send,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Map prototype icon names → lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  // Navigation
  home: Home,
  arrow_right: ArrowRight,
  arrow_left: ArrowLeft,
  arrow_up: ArrowUp,
  arrow_down: ArrowDown,
  arrow_up_right: ArrowUpRight,
  chevron_down: ChevronDown,
  chevron_up: ChevronUp,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,

  // Entities
  inbox: Inbox,
  target: Target,
  users: Users,
  user: User,
  file: FileText,
  receipt: Receipt,
  package: Package,
  building: Building2,
  briefcase: Briefcase,

  // Status / actions
  refresh: RefreshCw,
  clock: Clock,
  zap: Zap,
  bell: Bell,
  search: Search,
  plus: Plus,
  check: Check,
  check_circle: CheckCircle2,
  x: X,
  x_circle: XCircle,
  alert: AlertTriangle,
  info: Info,
  edit: Edit,
  trash: Trash2,
  copy: Copy,
  link: Link,
  external: ExternalLink,
  filter: Filter,
  more_h: MoreHorizontal,
  more_v: MoreVertical,
  download: Download,
  upload: Upload,
  send: Send,

  // Communication
  mail: Mail,
  phone: Phone,
  message: MessageSquare,
  whatsapp: MessageSquare, // lucide doesn't have WhatsApp brand icon; use MessageSquare

  // System
  settings: Settings,
  shield: Shield,
  globe: Globe,
  lock: Lock,
  logout: LogOut,
  database: Database,
  layout: Layout,
  layers: Layers,
  paint: PaintBucket,
  sliders: SlidersHorizontal,
  list: List,
  grid: Grid3x3,
  grip: GripVertical,

  // Charts
  chart: BarChart3,
  pie: PieChart,
  trending_up: TrendingUp,
  trending_down: TrendingDown,

  // Calendar / time
  calendar: Calendar,
  play: Play,

  // Misc
  star: Star,
  bolt: Bolt,
  sparkles: Sparkles,
  smile: Smile,
  question: HelpCircle,
  ticket: Ticket,
  book: BookOpen,
  rocket: Rocket,
  award: Award,
  cart: ShoppingCart,
  rupee: IndianRupee,
  sun: Sun,
  moon: Moon,
  mobile: Smartphone,
};

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: keyof typeof ICON_MAP | string;
  size?: number;
}

/**
 * Render an icon by prototype-compatible name.
 *
 * Unknown name → renders the AlertTriangle icon as a visible "missing icon" indicator
 * (instead of silent fail) so we catch typos early in dev.
 */
export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  const Component = ICON_MAP[name] ?? AlertTriangle;
  return (
    <Component
      width={size}
      height={size}
      className={cn(
        "inline-block flex-shrink-0",
        !ICON_MAP[name] && process.env.NODE_ENV === "development" && "text-rose",
        className
      )}
      strokeWidth={1.6}
      aria-hidden="true"
      {...rest}
    />
  );
}

// Backward-compat alias for prototype's `<I />` component
export { Icon as I };
