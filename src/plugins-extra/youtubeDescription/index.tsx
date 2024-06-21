/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { isNonNullish } from "@utils/guards";
import definePlugin, { OptionType } from "@utils/types";
import { useState } from "@webpack/common";
import { Embed } from "discord-types/general";

interface ToggleableDescriptionProps { embed: Embed, original: () => any; }

const settings = definePluginSettings({
    defaultState: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show full description by default",
    }
});

export default definePlugin({
    name: "YoutubeDescription",
    description: "Adds descriptions to youtube video embeds",
    authors: [Devs.arHSM],
    settings,
    patches: [
        {
            find: ".Messages.SUPPRESS_ALL_EMBEDS",
            replacement: {
                match: /case (\i\.\i\.VIDEO):(case \i\.\i\.\i:)*break;default:(\i)=(?:(this\.renderDescription)\(\))\}/,
                replace: "$2 break; case $1: $3 = $self.ToggleableDescriptionWrapper({ embed: this.props.embed, original: $4.bind(this) }); break; default: $3 = $4() }"
            }
        }
    ],
    ToggleableDescription: ErrorBoundary.wrap(({ embed, original }: ToggleableDescriptionProps) => {
        const [isOpen, setOpen] = useState(settings.store.defaultState);

        return !isNonNullish(embed.rawDescription)
            ? null
            : embed.rawDescription.length > 20
                ? <div
                    style={{ cursor: "pointer", marginTop: isOpen ? "0px" : "8px" }}
                    onClick={() => setOpen(o => !o)}
                >
                    {isOpen
                        ? original()
                        : embed.rawDescription.substring(0, 20) + "..."}
                </div>
                : original();
    }),
    ToggleableDescriptionWrapper(props: ToggleableDescriptionProps) {
        return <this.ToggleableDescription {...props}></this.ToggleableDescription>;
    }
});
