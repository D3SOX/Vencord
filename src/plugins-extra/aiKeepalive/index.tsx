/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { MessageStore, UserStore } from "@webpack/common";
import questionsJsonText from "file://questions.json";

// State variables
let activeChannelId: string | null = null;
let lastRespondedMessageId: string | null = null;
let responseTimeout: NodeJS.Timeout | null = null;

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

// Helper function to check if we should respond and send a message
function checkAndRespond(channelId: string) {
    if (!activeChannelId || channelId !== activeChannelId) {
        return;
    }

    try {
        const messages = MessageStore.getMessages(channelId);
        if (!messages || !messages._array || messages._array.length === 0) {
            return;
        }

        const lastMessage = messages._array[messages._array.length - 1] as Message;
        if (!lastMessage) {
            return;
        }

        // Don't respond if we already responded to this message
        if (lastMessage.id === lastRespondedMessageId) {
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) {
            return;
        }

        // Only respond if the last message is from someone else
        if (lastMessage.author.id !== currentUser.id) {
            // Clear any existing timeout
            if (responseTimeout) {
                clearTimeout(responseTimeout);
            }

            // Add a small delay to avoid race conditions
            responseTimeout = setTimeout(() => {
                // Double-check that we're still active and the last message hasn't changed
                const messages = MessageStore.getMessages(channelId);
                if (!messages || !messages._array || messages._array.length === 0) {
                    return;
                }

                const currentLastMessage = messages._array[messages._array.length - 1] as Message;
                if (!currentLastMessage || currentLastMessage.id !== lastMessage.id) {
                    return;
                }

                const currentUser = UserStore.getCurrentUser();
                if (!currentUser || currentLastMessage.author.id === currentUser.id) {
                    return;
                }

                // Send the response
                const message = generateRandomMessage();
                sendMessage(channelId, { content: message });
                lastRespondedMessageId = currentLastMessage.id;
                responseTimeout = null;
            }, 1500) as unknown as NodeJS.Timeout; // 1.5 second delay
        }
    } catch (e) {
        console.error("[AIKeepalive] Error checking and responding:", e);
    }
}

export default definePlugin({
    name: "AIKeepalive",
    description: "Automatically sends random messages to keep stupid AI bots active and waste their tokens",
    authors: [Devs.D3SOX],

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: Message; optimistic: boolean; }) {
            // Ignore optimistic messages (messages we're sending)
            if (optimistic) return;

            // Only respond to messages in the active channel
            if (activeChannelId && message.channel_id === activeChannelId) {
                checkAndRespond(message.channel_id);
            }
        },
    },

    commands: [
        {
            name: "aikeepalive",
            description: "Start sending random messages to keep chat active",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (args, ctx) => {
                // Clear any existing timeout if one is running
                if (responseTimeout) {
                    clearTimeout(responseTimeout);
                    responseTimeout = null;
                }

                // Store the channel ID and reset tracking
                activeChannelId = ctx.channel.id;
                lastRespondedMessageId = null;

                // Send confirmation message
                sendBotMessage(ctx.channel.id, {
                    content: "AI keepalive started! Will respond to messages to always have the last word.",
                });
            },
        },
        {
            name: "stopaikeepalive",
            description: "Stop sending keepalive messages",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (args, ctx) => {
                if (activeChannelId) {
                    if (responseTimeout) {
                        clearTimeout(responseTimeout);
                        responseTimeout = null;
                    }
                    activeChannelId = null;
                    lastRespondedMessageId = null;

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
        if (responseTimeout) {
            clearTimeout(responseTimeout);
            responseTimeout = null;
        }
        activeChannelId = null;
        lastRespondedMessageId = null;
    },
});
