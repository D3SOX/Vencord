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
let lastMessageTimestamp: number | null = null;
let inactivityTimeout: NodeJS.Timeout | null = null;

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

// Helper function to reset the inactivity timeout
function resetInactivityTimeout(channelId: string) {
    // Clear existing timeout
    if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = null;
    }

    // Set new timeout for 6 minutes (360000ms)
    inactivityTimeout = setTimeout(() => {
        if (!activeChannelId || channelId !== activeChannelId) {
            return;
        }

        // Check if we're still the last sender
        try {
            const messages = MessageStore.getMessages(channelId);
            if (!messages || !messages._array || messages._array.length === 0) {
                return;
            }

            const lastMessage = messages._array[messages._array.length - 1] as Message;
            if (!lastMessage) {
                return;
            }

            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) {
                return;
            }

            // If we're the last sender, send another message to keep conversation going
            if (lastMessage.author.id === currentUser.id) {
                const message = generateRandomMessage();
                sendMessage(channelId, { content: message });
                // Reset the timeout after sending
                resetInactivityTimeout(channelId);
            }
        } catch (e) {
            console.error("[AIKeepalive] Error in inactivity timeout:", e);
        }
    }, 360000) as unknown as NodeJS.Timeout; // 6 minutes
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
            // Update timestamp and reset inactivity timeout when we receive a message from someone else
            lastMessageTimestamp = Date.now();
            resetInactivityTimeout(channelId);

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
                // Reset inactivity timeout after sending our message
                resetInactivityTimeout(channelId);
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
                // Clear any existing timeouts if one is running
                if (responseTimeout) {
                    clearTimeout(responseTimeout);
                    responseTimeout = null;
                }
                if (inactivityTimeout) {
                    clearTimeout(inactivityTimeout);
                    inactivityTimeout = null;
                }

                // Store the channel ID and reset tracking
                activeChannelId = ctx.channel.id;
                lastRespondedMessageId = null;
                lastMessageTimestamp = null;

                // Initialize inactivity timeout
                resetInactivityTimeout(ctx.channel.id);

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
                    if (inactivityTimeout) {
                        clearTimeout(inactivityTimeout);
                        inactivityTimeout = null;
                    }
                    activeChannelId = null;
                    lastRespondedMessageId = null;
                    lastMessageTimestamp = null;

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
        if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = null;
        }
        activeChannelId = null;
        lastRespondedMessageId = null;
        lastMessageTimestamp = null;
    },
});
