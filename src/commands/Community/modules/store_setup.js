import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { isBotOwner } from '../../../config/bot.js';
import { storeConfig, storeFooter } from '../../../config/store.js';
import {
    getStoreSettings,
    resetStoreSettings,
    saveStoreSettings,
} from '../../../services/storeService.js';

const CHANNEL_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

function formatRoles(guildId, roleIds, emptyText) {
    if (!roleIds || roleIds.length === 0) return emptyText;
    return roleIds.map((id) => (id === guildId ? '@everyone' : `<@&${id}>`)).join(', ');
}

function formatChannel(channelId, emptyText) {
    return channelId ? `<#${channelId}>` : emptyText;
}

/** The embed that shows what a server is currently using. */
function buildSettingsEmbed(guildId, settings, title) {
    return {
        color: storeConfig.colors.stats,
        title,
        fields: [
            {
                name: '🔧 Staff Roles',
                value:
                    '`/store sale`, `stats` and the `void` commands\n' +
                    formatRoles(guildId, settings.staffRoleIds, '*Not set: only people with Manage Server can use them*'),
            },
            {
                name: '🎓 Review Roles',
                value:
                    'Who can use `/review`\n' +
                    formatRoles(guildId, settings.reviewRoleIds, '*Not set: only people with Manage Server can use it*'),
            },
            {
                name: '⭐ Review Channel',
                value: formatChannel(settings.reviewChannelId, "*Not set: `/review` can't post until this is set*"),
                inline: true,
            },
            {
                name: '📦 Sales Log Channel',
                value: formatChannel(settings.salesLogChannelId, '*Not set: sales are saved but not posted*'),
                inline: true,
            },
            {
                name: '📝 Vouch Channel',
                value: formatChannel(settings.vouchChannelId, '*Not set: looks for a channel named "vouches"*'),
                inline: true,
            },
            {
                name: '🛒 Buyer Role',
                value: settings.buyerRoleId
                    ? `<@&${settings.buyerRoleId}>`
                    : '*Not set: looks for a role named "Buyer" or "Buyers"*',
                inline: true,
            },
        ],
        footer: storeFooter(),
    };
}

function canManageStore(interaction) {
    return (
        Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) ||
        isBotOwner(interaction.user.id)
    );
}

function collectRoles(interaction, prefix) {
    const roles = [1, 2, 3]
        .map((n) => interaction.options.getRole(`${prefix}_${n}`))
        .filter(Boolean);
    return [...new Map(roles.map((role) => [role.id, role])).values()];
}

async function setup(interaction, client) {
    const guild = interaction.guild;
    const reset = interaction.options.getBoolean('reset') ?? false;
    const staffRoles = collectRoles(interaction, 'staff_role');
    const reviewRoles = collectRoles(interaction, 'review_role');
    const reviewChannel = interaction.options.getChannel('review_channel');
    const salesLogChannel = interaction.options.getChannel('sales_log_channel');
    const vouchChannel = interaction.options.getChannel('vouch_channel');
    const buyerRole = interaction.options.getRole('buyer_role');

    const given =
        staffRoles.length +
        reviewRoles.length +
        [reviewChannel, salesLogChannel, vouchChannel, buyerRole].filter(Boolean).length;

    if (!reset && given === 0) {
        return {
            content:
                'Nothing to change. Choose at least one option, or use `/store settings` to see the current settings.',
        };
    }

    // Staff commands must never be open to everyone.
    if (staffRoles.some((role) => role.id === guild.id)) {
        return { content: "❌ `@everyone` can't be a staff role. Pick a real staff role." };
    }

    if (buyerRole && (buyerRole.id === guild.id || buyerRole.managed)) {
        return { content: '❌ The buyer role must be a normal role (not @everyone or a bot/integration role).' };
    }

    // Make sure the bot can actually post in every channel that was chosen.
    const me = guild.members.me;
    for (const [label, channel] of [
        ['review channel', reviewChannel],
        ['sales log channel', salesLogChannel],
        ['vouch channel', vouchChannel],
    ]) {
        if (!channel) continue;
        const missing = CHANNEL_PERMISSIONS.filter((flag) => !channel.permissionsFor(me)?.has(flag));
        if (missing.length > 0) {
            return {
                content: `❌ I need **View Channel**, **Send Messages** and **Embed Links** in the ${label} (${channel}). Fix that and run the command again.`,
            };
        }
    }

    const patch = {};
    if (staffRoles.length) patch.staffRoleIds = staffRoles.map((role) => role.id);
    if (reviewRoles.length) patch.reviewRoleIds = reviewRoles.map((role) => role.id);
    if (reviewChannel) patch.reviewChannelId = reviewChannel.id;
    if (salesLogChannel) patch.salesLogChannelId = salesLogChannel.id;
    if (vouchChannel) patch.vouchChannelId = vouchChannel.id;
    if (buyerRole) patch.buyerRoleId = buyerRole.id;

    if (reset) await resetStoreSettings(client, guild.id);
    if (Object.keys(patch).length > 0) await saveStoreSettings(client, guild.id, patch);

    const settings = await getStoreSettings(client, guild.id);

    const warnings = [];
    if (buyerRole && me && (!me.permissions.has(PermissionFlagsBits.ManageRoles) || buyerRole.position >= me.roles.highest.position)) {
        warnings.push("⚠️ I can't give the buyer role yet. Move my role above it and give me **Manage Roles**.");
    }

    return {
        content: [reset ? '✅ Settings were reset and updated.' : '✅ Settings updated.', ...warnings].join('\n'),
        embeds: [buildSettingsEmbed(guild.id, settings, '★ Store Settings')],
    };
}

async function show(interaction, client) {
    const settings = await getStoreSettings(client, interaction.guildId);
    return { embeds: [buildSettingsEmbed(interaction.guildId, settings, '★ Store Settings')] };
}

export default {
    async execute(interaction, config, client) {
        if (!canManageStore(interaction)) {
            await InteractionHelper.safeReply(interaction, {
                content: '❌ You need the **Manage Server** permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        let reply;
        try {
            reply =
                interaction.options.getSubcommand() === 'setup'
                    ? await setup(interaction, client)
                    : await show(interaction, client);
        } catch (error) {
            logger.error('store setup failed:', error);
            reply = { content: "❌ I couldn't save the settings. Please try again." };
        }

        await InteractionHelper.safeEditReply(interaction, {
            ...reply,
            allowedMentions: { parse: [] },
        });
    },
};
