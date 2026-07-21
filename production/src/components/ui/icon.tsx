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
  // whatsapp → real brand mark, rendered by Icon() below (not a lucide glyph)

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
 * The real WhatsApp brand mark — solid green speech bubble with the white
 * phone handset (the recognisable app-icon look). Self-coloured, so it stays
 * on-brand regardless of the surrounding text colour. Lucide has no WhatsApp
 * glyph, so we render the authentic logo here.
 */
function WhatsAppMark({ size = 16, className, ...rest }: Omit<IconProps, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      {...rest}
    >
      <path
        fill="#25D366"
        d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z"
      />
      <path
        fill="#FFF"
        d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345z"
      />
    </svg>
  );
}

/**
 * Render an icon by prototype-compatible name.
 *
 * Unknown name → renders the AlertTriangle icon as a visible "missing icon" indicator
 * (instead of silent fail) so we catch typos early in dev.
 */
export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  if (name === "whatsapp") return <WhatsAppMark size={size} className={className} {...rest} />;
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
