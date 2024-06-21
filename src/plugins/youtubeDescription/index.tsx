/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "YoutubeDescription",
    description: "Adds descriptions to youtube video embeds",
    authors: [Devs.arHSM],
    patches: [
        {
            find: ".Messages.SUPPRESS_ALL_EMBEDS",
            replacement: {
                match: /case \i\.\i\.VIDEO:(case \i\.\i\.\i:)*break;default:(\i=this\.renderDescription\(\))\}/,
                replace: "$1 break; default: $2 }"
            }
        }
    ]
});
