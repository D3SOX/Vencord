/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { ChannelStore, GuildStore, UserStore } from "@webpack/common";
import { User } from "discord-types/general";

import { CustomVoiceChannelSection } from "./components/CustomVoiceChannelSection";
import VoiceActivityIcon from "./components/VoiceActivityIcon";
import { VoiceChannelSection } from "./components/VoiceChannelSection";

const VoiceStateStore = findStoreLazy("VoiceStateStore");

export const settings = definePluginSettings({
    showInUserProfileModal: {
        type: OptionType.BOOLEAN,
        description: "Show a user's voice channel in their profile modal",
        default: true,
    },
    showVoiceChannelSectionHeader: {
        type: OptionType.BOOLEAN,
        description: 'Whether to show "IN A VOICE CHANNEL" above the join button',
        default: true,
    },
    voiceChannelSection: {
        type: OptionType.SELECT,
        description: 'What "Voice Channel Section" should be shown',
        options: [
            {
                label: "Default",
                value: "default",
                default: true
            },
            {
                label: "Custom",
                value: "custom",
            }
        ]
    },
    showVoiceActivityIcons: {
        type: OptionType.BOOLEAN,
        description: "Show a user's voice activity in dm list and member list",
        default: true,
        restartNeeded: true,
    },
    showUsersInVoiceActivity: {
        type: OptionType.BOOLEAN,
        description: "Whether to show a list of users connected to a channel",
        default: true,
        disabled: () => !settings.store.showVoiceActivityIcons
    },
});

interface UserProps {
    user: User;
}

const VoiceChannelField = ErrorBoundary.wrap(({ user }: UserProps) => {
    const { channelId } = VoiceStateStore.getVoiceStateForUser(user.id) ?? {};
    if (!channelId) return null;

    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return null;

    const guild = GuildStore.getGuild(channel.guild_id);

    if (!guild) return null; // When in DM call

    const result = `${guild.name} | ${channel.name}`;

    return (
        settings.store.voiceChannelSection === "default" ?
            <VoiceChannelSection
                channel={channel}
                label={result}
                showHeader={settings.store.showVoiceChannelSectionHeader}
            /> : <CustomVoiceChannelSection
                channel={channel}
                joinDisabled={VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)?.channelId === channelId}
                showHeader={settings.store.showVoiceChannelSectionHeader}
            />
    );
});


export default definePlugin({
    name: "UserVoiceShow",
    description: "Shows whether a User is currently in a voice channel somewhere in their profile",
    authors: [Devs.LordElias, Devs.Johannes7k75],
    tags: ["voice", "activity"],
    settings,

    patchModal({ user }: UserProps) {
        if (!settings.store.showInUserProfileModal)
            return null;

        return (
            <div className="vc-uvs-modal-margin">
                <VoiceChannelField user={user} />
            </div>
        );
    },

    patchPopout: ({ user }: UserProps) => {
        const isSelfUser = user.id === UserStore.getCurrentUser().id;
        return (
            <div className={isSelfUser ? "vc-uvs-popout-margin-self" : ""}>
                <VoiceChannelField user={user} />
            </div>
        );
    },

    patchUserList: ({ user }: UserProps, dmList: boolean) => {
        if (!settings.store.showVoiceActivityIcons) return null;

        return (
            <ErrorBoundary noop>
                <VoiceActivityIcon user={user} dmChannel={dmList} />
            </ErrorBoundary>

        );
    },

    patchPrivateChannelProfile({ user }: UserProps) {
        if (!user) return;

        return <div className="vc-uvs-private-channel">
            <VoiceChannelField user={user} />
        </div>;
    },

    patches: [
        {
            find: ".popularApplicationCommandIds,",
            replacement: {
                match: /(?<=,)(?=!\i&&!\i&&.{0,50}setNote:)/,
                replace: "$self.patchPopout(arguments[0]),",
            }
        },
        {
            find: ".Messages.MUTUAL_GUILDS_WITH_END_COUNT", // Lazy-loaded
            replacement: {
                match: /applicationId:\i\.id}\),(?=.{0,50}setNote:\i)/,
                replace: "$&$self.patchPopout(arguments[0]),",
            }
        },
        {
            // Patch Member List
            find: ".MEMBER_LIST_ITEM_AVATAR_DECORATION_PADDING)",
            replacement: {
                match: /avatar:\i\(\i,\i\)/,
                replace: "children:[$self.patchUserList(arguments[0], false)],$&",
            }
        },
        {
            // Patch Dm List
            find: "PrivateChannel.renderAvatar",
            replacement: {
                match: /highlighted:.+?name:.+?decorators.+?\}\)\}\),/,
                replace: "$&$self.patchUserList(arguments[0], true),",
            }
        },
        // Private Channel Profile - above Activities
        {
            find: "UserProfileTypes.PANEL,useDefaultClientTheme",
            replacement: {
                match: /user:(\i).+?voiceGuild,voiceChannel.+?:null,/,
                replace: "$&$self.patchPrivateChannelProfile({user:$1}),"
            }
        }
    ],
});
