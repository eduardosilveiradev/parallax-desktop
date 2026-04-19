import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export type SessionSelectorProps = ComponentProps<typeof Dialog>;

export const SessionSelector = (props: SessionSelectorProps) => (
    <Dialog {...props} />
);

export type SessionSelectorTriggerProps = ComponentProps<typeof DialogTrigger>;

export const SessionSelectorTrigger = (props: SessionSelectorTriggerProps) => (
    <DialogTrigger {...props} />
);

export type SessionSelectorContentProps = ComponentProps<typeof DialogContent> & {
    title?: ReactNode;
};

export const SessionSelectorContent = ({
    className,
    children,
    title = "Session Selector",
    ...props
}: SessionSelectorContentProps) => (
    <DialogContent
        aria-describedby={undefined}
        className={cn(
            "outline! border-none! p-0 outline-border! outline-solid!",
            className
        )}
        {...props}
    >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Command className="**:data-[slot=command-input-wrapper]:h-auto">
            {children}
        </Command>
    </DialogContent>
);

export type SessionSelectorDialogProps = ComponentProps<typeof CommandDialog>;

export const SessionSelectorDialog = (props: SessionSelectorDialogProps) => (
    <CommandDialog {...props} />
);

export type SessionSelectorInputProps = ComponentProps<typeof CommandInput>;

export const SessionSelectorInput = ({
    className,
    ...props
}: SessionSelectorInputProps) => (
    <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
);

export type SessionSelectorListProps = ComponentProps<typeof CommandList>;

export const SessionSelectorList = (props: SessionSelectorListProps) => (
    <CommandList {...props} />
);

export type SessionSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const SessionSelectorEmpty = (props: SessionSelectorEmptyProps) => (
    <CommandEmpty {...props} />
);

export type SessionSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const SessionSelectorGroup = (props: SessionSelectorGroupProps) => (
    <CommandGroup {...props} />
);

export type SessionSelectorItemProps = ComponentProps<typeof CommandItem>;

export const SessionSelectorItem = (props: SessionSelectorItemProps) => (
    <CommandItem {...props} />
);

export type SessionSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const SessionSelectorShortcut = (props: SessionSelectorShortcutProps) => (
    <CommandShortcut {...props} />
);

export type SessionSelectorSeparatorProps = ComponentProps<typeof CommandSeparator>;

export const SessionSelectorSeparator = (props: SessionSelectorSeparatorProps) => (
    <CommandSeparator {...props} />
);

export type SessionSelectorNameProps = ComponentProps<"span">;

export const SessionSelectorName = ({
    className,
    ...props
}: SessionSelectorNameProps) => (
    <span className={cn("flex-1 truncate text-left", className)} {...props} />
);
