import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import {
    getStoreSettings,
    getTextChannel,
    isStoreAllowed,
    noAccessMessage,
    voidReview,
    voidSale,
    voidVouch,
} from '../../../services/storeService.js';

const VOIDED_COLOR = 0x99aab5;

async function fetchMessage(guild, channelId, messageId) {
    if (!channelId || !messageId) return null;
    const channel = await getTextChannel(guild, channelId);
    if (!channel) return null;
    return channel.messages.fetch(messageId).catch(() => null);
}

/** Deletes a posted message. Returns 'deleted', 'missing' (already gone / not saved) or 'failed'. */
async function deletePostedMessage(guild, entry) {
    if (!entry.channelId || !entry.messageId) return 'missing';
    const message = await fetchMessage(guild, entry.channelId, entry.messageId);
    if (!message) return 'missing';
    try {
        await message.delete();
        return 'deleted';
    } catch (error) {
        logger.warn(`void: could not delete message ${entry.messageId}: ${error.message}`);
        return 'failed';
    }
}

const MESSAGE_NOTE = {
    deleted: 'The posted message was deleted.',
    missing: 'The posted message was already gone, so nothing was deleted.',
    failed: "I couldn't delete the posted message (check my permissions). Please delete it manually.",
};

async function voidSaleCommand(interaction, client, meta) {
    const saleId = interaction.options.getInteger('sale_id');
    const result = await voidSale(client, interaction.guildId, saleId, meta);

    if (result.status === 'not_found') return `❌ I couldn't find sale #${saleId}.`;
    if (result.status === 'already_voided') return `❌ Sale #${saleId} was already voided.`;

    const sale = result.entry;
    let note = 'It no longer counts in the stats.';

    // Mark the original sales log message as voided.
    const logMessage = await fetchMessage(interaction.guild, sale.logChannelId, sale.logMessageId);
    if (logMessage?.embeds?.[0]) {
        try {
            const original = logMessage.embeds[0].toJSON();
            await logMessage.edit({
                embeds: [
                    {
                        ...original,
                        title: `VOIDED — ${original.title ?? `Sale #${sale.id}`}`,
                        color: VOIDED_COLOR,
                        fields: [
                            ...(original.fields ?? []),
                            {
                                name: '🚫 Voided',
                                value: `By ${interaction.user}${meta.reason ? `\n> ${meta.reason}` : ''}`,
                            },
                        ],
                    },
                ],
                allowedMentions: { parse: [] },
            });
            note += ' The sales log message was marked as voided.';
        } catch (error) {
            logger.warn(`void-sale: could not edit log message: ${error.message}`);
            note += " I couldn't edit the sales log message.";
        }
    }

    note += ' Roles already given to the customer (Buyers or milestone roles) were not removed.';
    return `✅ Sale #${saleId} voided. ${note}`;
}

async function voidReviewCommand(interaction, client, meta) {
    const ticketId = interaction.options.getInteger('ticket_id');
    const result = await voidReview(client, interaction.guildId, ticketId, meta);

    if (result.status === 'not_found') {
        return `❌ I couldn't find a saved review for ticket #${ticketId}. (Reviews posted before review tracking was added can only be deleted by hand.)`;
    }
    if (result.status === 'already_voided') return `❌ The review for ticket #${ticketId} was already voided.`;

    const messageStatus = await deletePostedMessage(interaction.guild, result.entry);
    return `✅ Review for ticket #${ticketId} voided. It no longer counts in the stats, and the ticket can be reviewed again. ${MESSAGE_NOTE[messageStatus]}`;
}

async function voidVouchCommand(interaction, client, meta) {
    const vouchId = interaction.options.getInteger('vouch_id');
    const result = await voidVouch(client, interaction.guildId, vouchId, meta);

    if (result.status === 'not_found') {
        return `❌ I couldn't find vouch #${vouchId}. (Vouches posted before vouch tracking was added can only be deleted by hand.)`;
    }
    if (result.status === 'already_voided') return `❌ Vouch #${vouchId} was already voided.`;

    const messageStatus = await deletePostedMessage(interaction.guild, result.entry);
    return `✅ Vouch #${vouchId} voided. ${MESSAGE_NOTE[messageStatus]}`;
}

const VOID_HANDLERS = {
    'void-sale': voidSaleCommand,
    'void-review': voidReviewCommand,
    'void-vouch': voidVouchCommand,
};

export default {
    async execute(interaction, config, client) {
        const settings = await getStoreSettings(client, interaction.guildId);
        if (!isStoreAllowed(interaction, settings.staffRoleIds)) {
            await InteractionHelper.safeReply(interaction, {
                content: noAccessMessage(settings.staffRoleIds),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const handler = VOID_HANDLERS[interaction.options.getSubcommand()];
        const meta = {
            by: interaction.user.id,
            reason: interaction.options.getString('reason')?.trim() || null,
        };

        let reply;
        try {
            reply = await handler(interaction, client, meta);
        } catch (error) {
            logger.error('void command failed:', error);
            reply = '❌ Something went wrong while voiding. Please try again.';
        }

        await InteractionHelper.safeEditReply(interaction, {
            content: reply,
            allowedMentions: { parse: [] },
        });
    },
};
