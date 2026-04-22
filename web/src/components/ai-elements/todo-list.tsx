"use client";

import { CheckCircle, Circle, ListDashes, ListChecks } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export interface Todo {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface TodoListProps {
    todos: Todo[];
    className?: string;
    onToggle?: (id: string) => void;
}

export function TodoList({ todos, className, onToggle }: TodoListProps) {
    const stats = useMemo(() => {
        const total = todos.length;
        const completed = todos.filter(t => t.status === 'completed').length;
        const progress = total > 0 ? (completed / total) * 100 : 0;
        return { total, completed, progress };
    }, [todos]);

    if (todos.length === 0) return null;

    return (
        <div className={cn("flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500", className)}>
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                        <ListChecks weight="duotone" className="size-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">Session Objectives</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">Progress</span>
                        <div className="text-[10px] font-bold text-primary/80">{stats.completed} / {stats.total}</div>
                    </div>
                    <div className="w-24 h-1.5 rounded-full bg-border/30 overflow-hidden relative">
                        <div 
                            className="absolute inset-y-0 left-0 bg-primary transition-all duration-1000 ease-in-out"
                            style={{ width: `${stats.progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 px-1">
                {todos.map((t, idx) => (
                    <div 
                        key={t.id} 
                        onClick={() => onToggle?.(t.id)}
                        className={cn(
                            "flex items-start gap-3 group transition-all duration-300",
                            onToggle ? "cursor-pointer" : "cursor-default",
                            t.status === 'completed' ? "opacity-50" : "opacity-100"
                        )}
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className="mt-0.5 shrink-0 relative">
                            {t.status === 'completed' ? (
                                <CheckCircle weight="fill" className="size-4.5 text-green-500/80 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                            ) : t.status === 'in_progress' ? (
                                <div className="size-4.5 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
                            ) : (
                                <Circle weight="bold" className="size-4.5 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                            )}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className={cn(
                                "text-xs leading-relaxed transition-all break-words",
                                t.status === 'completed' ? "line-through text-muted-foreground/70 italic font-sans" : "text-foreground/90 font-medium font-sans"
                            )}>
                                {t.content}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
