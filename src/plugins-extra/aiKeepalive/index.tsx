/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import questionsJsonText from "file://questions.json";

// State variables
let keepaliveInterval: NodeJS.Timeout | null = null;
let activeChannelId: string | null = null;

// Load questions from JSON file
let complexProblems: string[] = [];

try {
    const parsed = JSON.parse(questionsJsonText) as string[];
    if (Array.isArray(parsed) && parsed.length > 0) {
        complexProblems = parsed;
        console.log(`[AIKeepalive] Loaded ${complexProblems.length} questions from questions.json`);
    } else {
        console.warn("[AIKeepalive] questions.json is empty or invalid. Please generate questions using generate_questions.py");
    }
} catch (e) {
    console.error("[AIKeepalive] Failed to parse questions.json:", e);
    console.warn("[AIKeepalive] Please generate questions using generate_questions.py");
}

// Helper function to generate random messages from complex problems
function generateRandomMessage(): string {
    if (complexProblems.length === 0) {
        return "No questions available. Please generate questions using generate_questions.py";
    }
    return complexProblems[Math.floor(Math.random() * complexProblems.length)];
}

export default definePlugin({
    name: "AIKeepalive",
    description: "Automatically sends random messages to keep stupid AI bots active and waste their tokens",
    authors: [Devs.D3SOX],

    commands: [
        {
            name: "aikeepalive",
            description: "Start sending random messages to keep chat active",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (args, ctx) => {
                // Clear any existing timeout if one is running
                if (keepaliveInterval) {
                    clearTimeout(keepaliveInterval);
                    keepaliveInterval = null;
                }

                // Store the channel ID
                activeChannelId = ctx.channel.id;

                // Send confirmation message
                sendBotMessage(ctx.channel.id, {
                    content: "AI keepalive started! Sending random messages...",
                });

                // Start sending random messages with 10 second intervals
                const sendRandomMessage = () => {
                    if (activeChannelId) {
                        const message = generateRandomMessage();
                        sendMessage(activeChannelId, { content: message });
                    }
                };

                // Send first message immediately
                sendRandomMessage();

                // Set up recursive timeout with random delay between 25-30 seconds
                const scheduleNext = () => {
                    const delay = Math.floor(Math.random() * 5000) + 25000; // 25-30 seconds
                    keepaliveInterval = setTimeout(() => {
                        sendRandomMessage();
                        scheduleNext(); // Schedule the next message
                    }, delay) as unknown as NodeJS.Timeout;
                };

                // Start scheduling subsequent messages
                scheduleNext();
            },
        },
        {
            name: "stopaikeepalive",
            description: "Stop sending keepalive messages",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (args, ctx) => {
                if (keepaliveInterval) {
                    clearTimeout(keepaliveInterval);
                    keepaliveInterval = null;
                    activeChannelId = null;

                    sendBotMessage(ctx.channel.id, {
                        content: "AI keepalive stopped!",
                    });
                } else {
                    sendBotMessage(ctx.channel.id, {
                        content: "AI keepalive is not currently running.",
                    });
                }
            },
        },
    ],

    stop() {
        if (keepaliveInterval) {
            clearTimeout(keepaliveInterval);
            keepaliveInterval = null;
            activeChannelId = null;
        }
    },
});
