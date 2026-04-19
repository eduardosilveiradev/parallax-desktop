"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";

export default function ShimmerTestPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
            <div className="max-w-md w-full border border-border/40 bg-card rounded-lg p-12 flex flex-col items-center justify-center shadow-sm">
                <h1 className="text-sm font-mono tracking-widest text-muted-foreground uppercase mb-12">
                    Shimmer Component
                </h1>
                
                <div className="w-full flex flex-col gap-8 items-center">
                    <Shimmer>GENERATING RESPONSE</Shimmer>
                    
                    <div className="w-full h-px bg-border/40 my-4" />
                    
                    <Shimmer>Working...</Shimmer>
                    
                    <div className="w-full h-px bg-border/40 my-4" />
                    
                    <Shimmer>Thinking</Shimmer>
                </div>
            </div>
        </main>
    );
}
