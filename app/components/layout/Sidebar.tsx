'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, MessageSquare, ClipboardList, Bot, Brain, Settings, Clock, CheckSquare, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Conversation', href: '/', icon: MessageSquare },
  { name: 'Blackboard View', href: '/blackboard-view', icon: BookOpen },
  { name: 'Blackboard Explorer', href: '/blackboard', icon: ClipboardList },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Models', href: '/models', icon: Brain },
  { name: 'Config', href: '/config', icon: Settings },
  { name: 'Timeline', href: '/timeline', icon: Clock },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'bg-card border-r h-screen flex flex-col transition-all duration-300 ease-in-out relative',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className={cn('p-4 border-b flex items-center', isCollapsed && 'justify-center')}>
          {!isCollapsed && (
            <h1 className="text-2xl font-bold flex-1">AutoAgent</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-8 w-8"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 flex-1 p-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
            const Icon = item.icon;
            
            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg transition-colors relative",
                  isCollapsed ? "justify-center px-3 py-3" : "px-4 py-3",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("flex-shrink-0", isCollapsed ? "h-5 w-5" : "h-5 w-5")} />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="ml-2">
                    <p>{item.name}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={item.name}>
                {linkContent}
              </div>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
}
