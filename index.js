
import { before, instead, after } from "@vendetta/patcher";
import { findByProps, find } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { sendMessage } from "@vendetta/plugins/discord/flux/MessageActions";

let patches = [];

export const onLoad = () => {
    const Stickers = findByProps("isSendableSticker", "getStickerSendability");
    const GuildStickers = findByProps("getPremiumPacks", "getAllGuildStickers", "getStickerById");
    const Channels = findByProps("getChannel");
    const MessageSender = findByProps("sendMessage", "sendStickers");
    const Permissions = findByProps("getChannelPermissions");
    const canUseCustomStickersEverywhere = find(m => m?.default?.canUseCustomStickersEverywhere);
    
    const PermissionsConstants = findByProps("Permissions");
    const icon = "ic_clock"; // Dummy icon name

    async function convertAndSendAPNGtoGIF(url, channelId) {
        showToast("Processing Sticker...", icon);
        let form = new FormData();
        form.append("new-image-url", url);

        let res = await fetch("https://ezgif.com/apng-to-gif", { method: "POST", body: form });
        let id = res.url.split("/").pop();

        form = new FormData();
        form.append("file", id);
        res = await fetch(`https://ezgif.com/apng-to-gif/${id}?ajax=true`, { method: "POST", body: form });
        let html = await res.text();
        let gifUrl = "https:" + html.split('<img src="')[1].split('" style=')[0];

        let file = gifUrl.split("/").pop();
        form = new FormData();
        form.append("file", file);
        form.append("height", "160");
        res = await fetch(`https://ezgif.com/resize/${file}?ajax=true`, { method: "POST", body: form });
        html = await res.text();
        gifUrl = "https:" + html.split('<img src="')[1].split('" style=')[0];

        sendMessage(channelId, { content: gifUrl });
    }

    if (canUseCustomStickersEverywhere?.default) {
        patches.push(instead(canUseCustomStickersEverywhere.default, "canUseCustomStickersEverywhere", () => true));
    }
    patches.push(instead(Stickers, "getStickerSendability", () => 0));
    patches.push(after(Stickers, "isSendableSticker", () => true));

    patches.push(instead(MessageSender, "sendStickers", (args, orig) => {
        const channel = Channels.getChannel(args[0]);
        const sticker = GuildStickers.getStickerById(args[1][0]);

        if (channel.guild_id === sticker.guild_id) return orig(...args);

        if (channel.guild_id && !Permissions.getChannelPermissions(channel.id).has(PermissionsConstants.EMBED_LINKS)) {
            showToast("Embed Link is disabled in this channel");
        } else {
            const url = `https://media.discordapp.net/stickers/${sticker.id}.png`;
            if (sticker.format_type === 1) {
                sendMessage(channel.id, { content: `${url}?size=160` });
            } else if (sticker.format_type === 2) {
                convertAndSendAPNGtoGIF(url, channel.id);
            } else if (sticker.format_type === 3) {
                sendMessage(channel.id, { content: `https://raw.githubusercontent.com/m4fn3/RawStickers/master/${sticker.pack_id}/${sticker.id}.gif` });
            }
        }
    }));
};

export const onUnload = () => {
    for (const unpatch of patches) unpatch();
    patches = [];
};
