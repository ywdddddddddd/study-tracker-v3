"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Dumbbell,
  Calendar,
  ClipboardCheck,
  Heart,
  BarChart3,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/nutrition", label: "饮食营养", icon: UtensilsCrossed },
  { href: "/fitness", label: "健身运动", icon: Dumbbell },
  { href: "/daily-plan", label: "每日学习", icon: Calendar },
  { href: "/weekly-review", label: "周回顾", icon: ClipboardCheck },
  { href: "/health", label: "健康睡眠", icon: Heart },
  { href: "/analytics", label: "数据分析", icon: BarChart3 },
  { href: "/ai", label: "AI助手", icon: Sparkles },
  { href: "/settings", label: "设置", icon: Settings },
];

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-2 py-2">
      {navItems.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile: Sheet drawer */}
      <Sheet>
        <SheetTrigger className="fixed top-3 left-3 z-50 lg:hidden inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted transition-colors">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center border-b px-4">
            <Link href="/" className="flex items-center gap-2 font-heading text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>All in One</span>
            </Link>
          </div>
          <ScrollArea className="flex-1">
            <SidebarNav collapsed={false} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 border-r bg-card shrink-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-14 border-b px-4", collapsed && "justify-center")}>
          {collapsed ? (
            <Sparkles className="h-5 w-5 text-primary" />
          ) : (
            <Link href="/" className="flex items-center gap-2 font-heading text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>All in One</span>
            </Link>
          )}
        </div>

        <ScrollArea className="flex-1">
          <SidebarNav collapsed={collapsed} />
        </ScrollArea>

        <Separator />

        {/* Collapse toggle */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
