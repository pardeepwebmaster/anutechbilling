import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl text-center">
        <Badge kind="info" dot className="mb-6">
          Foundation ready · Week 1 in progress
        </Badge>

        <h1 className="font-serif text-5xl md:text-6xl leading-tight mb-4 tracking-tight">
          ResellerOS
        </h1>

        <p className="text-lg text-ink-3 mb-8 leading-relaxed">
          The complete operating system for Indian cloud resellers. Currently
          building — see component library at <span className="font-mono text-sm bg-paper-2 px-2 py-0.5 rounded">/dev/components</span>.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Button asChild variant="primary" iconRight="arrow_right">
            <Link href="/dev/components">View components</Link>
          </Button>
          <Button asChild variant="default" icon="external">
            <Link href="https://github.com/" target="_blank">
              GitHub
            </Link>
          </Button>
        </div>

        <div className="mt-12 text-xs text-ink-3 font-mono">
          v0.1.0 · Next.js 14 + TypeScript + Tailwind + Supabase
        </div>
      </div>
    </main>
  );
}
