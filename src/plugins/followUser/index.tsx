/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { FollowIcon, UnfollowIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { LazyComponent } from "@utils/lazyReact";
import definePlugin, { OptionType } from "@utils/types";
import { filters, find, findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, React, SelectedChannelStore, Toasts, UserStore } from "@webpack/common";
import { VoiceState } from "@webpack/types";
import type { Channel, User } from "discord-types/general";

const HeaderBarIcon = LazyComponent(() => {
    const filter = filters.byCode(".HEADER_BAR_BADGE");
    return find(m => m.Icon && filter(m.Icon)).Icon;
});

export const settings = definePluginSettings({
    executeOnFollow: {
        type: OptionType.BOOLEAN,
        description: "Make sure to be in the same VC when following a user",
        restartNeeded: false,
        default: true
    },
    onlyManualTrigger: {
        type: OptionType.BOOLEAN,
        description: "Only trigger on indicator click",
        restartNeeded: false,
        default: false
    },
    followLeave: {
        type: OptionType.BOOLEAN,
        description: "Also leave when the followed user leaves",
        restartNeeded: false,
        default: false
    },
    autoMoveBack: {
        type: OptionType.BOOLEAN,
        description: "Automatically move back to the VC of the followed user when you got moved",
        restartNeeded: false,
        default: false
    },
    followUserId: {
        type: OptionType.STRING,
        description: "Followed User ID",
        restartNeeded: false,
        hidden: true, // Managed via context menu and indicator
        default: "",
    },
    channelFull: {
        type: OptionType.BOOLEAN,
        description: "Attempt to move you to the channel when is not full anymore",
        restartNeeded: false,
        default: false
    }
});

let userChannelIdCached;
const ChannelActions: {
    disconnect: () => void;
    selectVoiceChannel: (channelId: string) => void;
} = findByPropsLazy("disconnect", "selectVoiceChannel");

const VoiceStateStore: VoiceStateStore = findStoreLazy("VoiceStateStore");
const CONNECT = 1n << 20n;

interface VoiceStateStore {
    getAllVoiceStates(): VoiceStateEntry;
    getVoiceStatesForChannel(channelId: string): VoiceStateMember;
}

interface VoiceStateEntry {
    [guildIdOrMe: string]: VoiceStateMember;
}

interface VoiceStateMember {
    [userId: string]: VoiceState;
}

function getChannelId(userId: string) {
    if (!userId) {
        return null;
    }
    try {
        const states = VoiceStateStore.getAllVoiceStates();
        for (const users of Object.values(states)) {
            if (users[userId]) {
                return users[userId].channelId ?? null;
            }
        }
    } catch (e) { }
    return null;
}

function triggerFollow(userChannelId: string | null = getChannelId(settings.store.followUserId), retry = false) {
    if (settings.store.followUserId) {
        const myChanId = SelectedChannelStore.getVoiceChannelId();
        if (userChannelId) {
            // join when not already in the same channel
            if (userChannelId !== myChanId) {
                const channel = ChannelStore.getChannel(userChannelId);
                const voiceStates = VoiceStateStore.getVoiceStatesForChannel(userChannelId);
                const memberCount = voiceStates ? Object.keys(voiceStates).length : null;
                if (PermissionStore.can(CONNECT, channel)) {
                    if (channel.userLimit !== 0 && memberCount && memberCount >= channel.userLimit && !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) {
                        if (settings.store.channelFull) {
                            userChannelIdCached = userChannelId;
                            setTimeout(() => {
                                triggerFollow(userChannelId, true);
                            }, 5000);
                        }
                        if (!retry) {
                            Toasts.show({
                                message: "Channel is full",
                                id: Toasts.genId(),
                                type: Toasts.Type.FAILURE
                            });
                        }
                        return;
                    } else {
                        userChannelIdCached = null;
                    }
                    if (retry) {
                        if (!userChannelIdCached) {
                            return;
                        }
                        if (userChannelId !== userChannelIdCached) {
                            userChannelIdCached = null;
                            return triggerFollow();
                        }
                    }
                    ChannelActions.selectVoiceChannel(userChannelId);
                    Toasts.show({
                        message: "Followed user into a new voice channel",
                        id: Toasts.genId(),
                        type: Toasts.Type.SUCCESS
                    });
                } else {
                    Toasts.show({
                        message: "Insufficient permissions to enter in the voice channel",
                        id: Toasts.genId(),
                        type: Toasts.Type.FAILURE
                    });
                }
            } else {
                Toasts.show({
                    message: "You are already in the same channel",
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE
                });
            }
        } else if (myChanId) {
            // if not in a voice channel and the setting is on disconnect
            if (settings.store.followLeave) {
                ChannelActions.disconnect();
                Toasts.show({
                    message: "Followed user left, disconnected",
                    id: Toasts.genId(),
                    type: Toasts.Type.SUCCESS
                });
            } else {
                Toasts.show({
                    message: "Followed user left, but not following disconnect",
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE
                });
            }
        } else {
            Toasts.show({
                message: "Followed user is not in a voice channel",
                id: Toasts.genId(),
                type: Toasts.Type.FAILURE
            });
        }
    }
}

function toggleFollow(userId: string) {
    if (settings.store.followUserId === userId) {
        settings.store.followUserId = "";
    } else {
        settings.store.followUserId = userId;
        if (settings.store.executeOnFollow) {
            triggerFollow();
        }
    }
}

interface UserContextProps {
    channel: Channel;
    guildId?: string;
    user: User;
}

const UserContext: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => () => {
    if (!user || user.id === UserStore.getCurrentUser().id) return;
    const isFollowed = settings.store.followUserId === user.id;
    const label = isFollowed ? "Unfollow User" : "Follow User";
    const icon = isFollowed ? UnfollowIcon : FollowIcon;

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="follow-user"
                label={label}
                action={() => toggleFollow(user.id)}
                icon={icon}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "FollowUser",
    description: "Adds a follow option in the user context menu to always be in the same VC as them",
    authors: [Devs.D3SOX],

    settings,

    patches: [
        {
            find: "toolbar:function",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,100}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        },
    ],

    start() {
        addContextMenuPatch("user-context", UserContext);
    },

    stop() {
        removeContextMenuPatch("user-context", UserContext);
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (settings.store.onlyManualTrigger || !settings.store.followUserId) {
                return;
            }
            for (const { userId, channelId, oldChannelId } of voiceStates) {
                if (channelId !== oldChannelId) {
                    const isMe = userId === UserStore.getCurrentUser().id;
                    // move back if the setting is on and you were moved
                    if (isMe && channelId && settings.store.autoMoveBack) {
                        triggerFollow();
                        continue;
                    }

                    const isFollowed = settings.store.followUserId === userId;
                    if (!isFollowed) {
                        continue;
                    }

                    if (channelId) {
                        // move or join new channel -> also join
                        triggerFollow(channelId);
                    } else if (oldChannelId) {
                        // leave -> disconnect
                        triggerFollow(null);
                    }
                }
            }
        },
    },

    FollowIndicator() {
        const { plugins: { FollowUser: { followUserId } } } = useSettings(["plugins.FollowUser.followUserId"]);
        if (followUserId) {
            return (
                <HeaderBarIcon
                    className="vc-follow-user-indicator"
                    tooltip={`Following ${UserStore.getUser(followUserId).username} (click to trigger manually, right-click to unfollow)`}
                    icon={UnfollowIcon}
                    onClick={() => {
                        triggerFollow();
                    }}
                    onContextMenu={() => {
                        settings.store.followUserId = "";
                    }}
                />
            );
        }

        return null;
    },

    addIconToToolBar(e: { toolbar: React.ReactNode[] | React.ReactNode; }) {
        if (Array.isArray(e.toolbar)) {
            return e.toolbar.push(
                <ErrorBoundary noop={true} key="follow-indicator">
                    <this.FollowIndicator />
                </ErrorBoundary>
            );
        }

        e.toolbar = [
            <ErrorBoundary noop={true} key="follow-indicator">
                <this.FollowIndicator />
            </ErrorBoundary>,
            e.toolbar,
        ];
    },

});
