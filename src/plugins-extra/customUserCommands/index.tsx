/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Menu, React, UserStore } from "@webpack/common";
import type { Channel, User } from "discord-types/general";

// TODO: allow multiple commands with a table like
// TODO: NAME | COMMAND | CHANNEL
export const settings = definePluginSettings({
    command: {
        type: OptionType.STRING,
        description: "Command to execute",
        restartNeeded: false,
        default: "!voice-ban @user",
    },
    channelId: {
        type: OptionType.STRING,
        description: "Channel where to post the message",
        restartNeeded: false,
        default: ""
    }
});

interface UserContextProps {
    channel?: Channel;
    guildId?: string;
    user: User;
}

const UserContext: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!user || user.id === UserStore.getCurrentUser().id) {
        return;
    }
    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="custom-command"
                label={"Run custom command"}
                // icon={}
                action={() => runUserCommand(user, settings.store.command)}
            />
        </Menu.MenuGroup>
    ));
};

function runUserCommand(user: User, command: string) {
    const realCommand = command.replace("@user", `<@${user.id}>`);
    sendMessage(settings.store.channelId, { content: realCommand });
}

export default definePlugin({
    name: "CustomUserCommands",
    description: "Configure custom command to run on users (via context menu)",
    authors: [Devs.D3SOX],

    settings,

    contextMenus: {
        "user-context": UserContext
    },
});
