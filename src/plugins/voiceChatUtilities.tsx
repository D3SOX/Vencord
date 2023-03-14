/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { addContextMenuPatch, findGroupChildrenByChildId, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps, findStoreLazy } from "@webpack";
import { Menu, RestAPI, UserStore } from "@webpack/common";

const VoiceStateStore = findStoreLazy("VoiceStateStore");


function sendPatch(channel, body, bypass = false) {
    const usersVoice = VoiceStateStore.getVoiceStatesForChannel(channel.id); // Get voice states by channel id
    const myId = UserStore.getCurrentUser().id; // Get my user id

    Object.keys(usersVoice).forEach(function (key, index) {
        const userVoice = usersVoice[key];

        if (bypass || userVoice.userId !== myId) {
            setTimeout(() => {
                RestAPI.patch({
                    url: `/guilds/${channel.guild_id}/members/${userVoice.userId}`,
                    body: body
                });
            }, index * 500);
        }
    });
}

const voiceChannelContextMenuPatch: NavContextMenuPatchCallback = (children, args) => {

    if (!args?.[0]) return;
    if (args[0].channel && !args[0].channel.bitrate_) { return; }

    var channels = findByProps("getChannels");
    const guildChannels = channels.getChannels(args[0].channel.guild_id);
    const voiceChannels = guildChannels.VOCAL.map(({ channel }) => channel);

    const group = findGroupChildrenByChildId("mute-channel", children);
    if (group && !group.some(child => child?.props?.id === "voice-tools")) {
        group.push((
            <Menu.MenuItem
                label="Voice Tools"
                key="voice-tools"
                id="voice-tools"
            >
                <Menu.MenuItem
                    key="voice-tools-disconnect-all"
                    id="voice-tools-disconnect-all"
                    label="Disconnect all"
                    action={() => sendPatch(args[0].channel, {
                        channel_id: null,
                    })}
                />

                <Menu.MenuItem
                    key="voice-tools-mute-all"
                    id="voice-tools-mute-all"
                    label="Mute all"
                    action={() => sendPatch(args[0].channel, {
                        mute: true,
                    })}
                />

                <Menu.MenuItem
                    key="voice-tools-unmute-all"
                    id="voice-tools-unmute-all"
                    label="Unmute all"
                    action={() => sendPatch(args[0].channel, {
                        mute: false,
                    })}
                />

                <Menu.MenuItem
                    key="voice-tools-deafen-all"
                    id="voice-tools-deafen-all"
                    label="Deafen all"
                    action={() => sendPatch(args[0].channel, {
                        deaf: true,
                    })}
                />

                <Menu.MenuItem
                    key="voice-tools-undeafen-all"
                    id="voice-tools-undeafen-all"
                    label="Undeafen all"
                    action={() => sendPatch(args[0].channel, {
                        deaf: false,
                    })}
                />

                <Menu.MenuItem
                    label="Move all"
                    key="voice-tools-move-all"
                    id="voice-tools-move-all"
                >

                    {voiceChannels.map(channel => {
                        return (
                            <Menu.MenuItem
                                key={channel.id}
                                id={channel.id}
                                label={channel.name}
                                action={() => sendPatch(args[0].channel, {
                                    channel_id: channel.id,
                                }, true)}
                            />
                        );
                    })}

                </Menu.MenuItem>


            </Menu.MenuItem>
        ));
    }
};



export default definePlugin({
    name: "Voice Chat Utilities",
    description: "This plugin allows you to perform multiple actions on an entire channel (move, mute, disconnect, etc.)",
    authors: [
        {
            id: 769939285792653325n,
            name: "! 𝕯'𝖆𝖒𝖘 (ported to Vencord)",
        },
        {
            id: 1245n,
            name: "dutake (original code)"
        }

    ],
    patches: [],
    // Delete these two below if you are only using code patches
    start() {
        addContextMenuPatch("channel-context", voiceChannelContextMenuPatch);
    },

    stop() {
        removeContextMenuPatch("channel-context", voiceChannelContextMenuPatch);
    },
});

