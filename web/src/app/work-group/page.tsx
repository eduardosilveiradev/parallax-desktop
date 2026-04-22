"use client";

import { useEffect, useState } from "react";
import { WorkGroup } from "@/components/dynamic-work-group";

export default function WorkGroupPage() {
    const [phase, setPhase] = useState(0);
    const totalPhases = 6;

    useEffect(() => {
        const timer = setInterval(() => {
            setPhase((p) => (p + 1) % totalPhases);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    const getDynamicGroup = () => {
        const blocks = [];

        // Phase 0+: Thinking is always there
        blocks.push({
            type: "thinking",
            id: "think-1",
            text: phase === 0 ? "Analyzing..." : "I need to analyze the project structure and determine how to implement the new feature.",
            duration: phase > 0 ? 2.5 : 0
        });

        // Phase 1+: ListDir
        if (phase >= 1) {
            blocks.push({
                type: "tool-call",
                id: "tool-1",
                awaitConfirm: false,
                call: {
                    id: "call-1",
                    name: "ListDir",
                    args: { DirectoryPath: "/src" },
                    status: phase >= 2 ? "done" : "calling",
                    result: phase >= 2 ? "Directory listing: \n- main.ts\n- server.ts\n- tools.ts" : undefined
                }
            });
        }

        // Phase 3+: ReplaceFileContent
        if (phase >= 3) {
            blocks.push({
                type: "tool-call",
                id: "tool-2",
                awaitConfirm: phase === 3,
                call: {
                    id: "call-2",
                    name: "ReplaceFileContent",
                    args: {
                        TargetFile: "/src/server.ts",
                        TargetContent: "console.log('Old log');",
                        ReplacementContent: "console.log('New premium log');"
                    },
                    status: phase >= 5 ? "done" : "calling",
                    result: phase >= 5 ? { success: true } : undefined
                }
            });
        }

        return {
            id: "session-dynamic",
            blocks,
            isDone: phase === 5,
            duration: phase === 5 ? 15 : 0
        };
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-zinc-100">WorkGroup Simulation</h1>
                <div className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-mono text-zinc-400">
                    Phase: {phase} / {totalPhases - 1}
                </div>
            </div>

            <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-950/50 backdrop-blur-sm">
                <WorkGroup
                    group={getDynamicGroup()}
                    streaming={phase < 5}
                    isLast={true}
                    onApprove={() => { }}
                    onReject={() => { }}
                    onSubmit={() => { }}
                />
            </div>

            <p className="text-center text-xs text-zinc-500 italic">
                The UI above cycles through different agent states every 3 seconds.
            </p>
        </div>
    );
}