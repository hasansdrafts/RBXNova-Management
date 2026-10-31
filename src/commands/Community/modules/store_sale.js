import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter, memberHasAnyRole } from '../../../config/store.js';
import {
    addSale,
    applyMilestone,
    assignBuyerRole,
    getTextChannel,
    updateSale,
} from '../../../services/storeService.js';

const ROLE_STATUS_TEXT = {
    added: 'given',
    already: 'already had it',
    no_role: 'role not found',
    cannot_manage: "I can't manage that role (move my role above it and give me Manage Roles)",
    not_in_server: 'customer is not in the server',
    failed: 'could not be given',
};

export default {
    async execute(interaction, config, client) {
        if (!memberHasAnyRole(interaction.member, storeConfig.staffRoleIds)) {
            await InteractionHelper.safeReply(interaction, {
                content: "❌ You don't have the required role to use this command.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const customer = interaction.options.getUser('customer');
        const robux = interaction.options.getInteger('robux');
        const price = interaction.options.getString('price')?.trim() || null;
        const handler = interaction.options.getUser('handler') ?? interaction.user;
        const ticketId = interaction.options.getInteger('ticket_id');

        if (customer.bot) {
            await InteractionHelper.safeReply(interaction, {
                content: '❌ The customer cannot be a bot.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const guild = interaction.guild;

        // 1. Save the sale.
        let saved;
        try {
            saved = await addSale(client, guild.id, {
                customerId: customer.id,
                handlerId: handler.id,
                loggedBy: interaction.user.id,
                robux,
                price,
                ticketId,
            });
        } catch (error) {
            logger.error('sale: could not save sale:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ I could not save this sale. Please try again.',
            });
            return;
        }

        const { sale, customerPurchases } = saved;
        const notes = [];

        // 2. Buyer role.
        const buyer = await assignBuyerRole(guild, customer.id).catch((error) => {
            logger.error('sale: buyer role failed:', error);
            return { status: 'failed', role: null };
        });
        notes.push(`Buyer role: ${ROLE_STATUS_TEXT[buyer.status] ?? buyer.status}`);

        // 3. Milestones.
        const milestone = await applyMilestone(guild, customer.id, customerPurchases).catch((error) => {
            logger.error('sale: milestone failed:', error);
            return null;
        });
        if (milestone) {
            const roleNote = milestone.role
                ? `role ${ROLE_STATUS_TEXT[milestone.status] ?? milestone.status}`
                : `no role named "${milestone.tier.roleName}" found`;
            notes.push(`Milestone (${milestone.tier.purchases} purchases): ${roleNote}`);
        }

        // 4. Post to the sales log channel.
        const fields = [
            { name: '🎓 Customer', value: `${customer}`, inline: true },
            { name: '🔧 Handler', value: `${handler}`, inline: true },
            { name: '📦 Robux Sold', value: `${robux.toLocaleString('en-US')} Robux`, inline: true },
        ];
        if (price) fields.push({ name: '💰 Paid', value: price, inline: true });
        if (ticketId) fields.push({ name: '🎫 Ticket', value: `#${ticketId}`, inline: true });
        fields.push({ name: '🛒 Customer Purchases', value: `${customerPurchases}`, inline: true });
        if (milestone) {
            fields.push({
                name: '🏆 Milestone Reached',
                value: `${milestone.tier.roleName} (${milestone.tier.purchases} purchases)`,
            });
        }

        const logEmbed = {
            color: storeConfig.colors.sale,
            title: `New Sale — #${sale.id}`,
            fields,
            footer: storeFooter(),
        };

        if (storeConfig.salesLogChannelId) {
            try {
                const logChannel = await getTextChannel(guild, storeConfig.salesLogChannelId);
                if (!logChannel) throw new Error('Sales log channel not found');
                const logMessage = await logChannel.send({ embeds: [logEmbed], allowedMentions: { parse: [] } });
                await updateSale(client, guild.id, sale.id, {
                    logChannelId: logMessage.channelId,
                    logMessageId: logMessage.id,
                }).catch((error) => logger.warn(`sale: could not save log message id: ${error.message}`));
                notes.push('Posted in the sales log');
            } catch (error) {
                logger.error('sale: could not post to sales log channel:', error);
                notes.push('Could not post in the sales log channel');
            }
        } else {
            notes.push('No sales log channel set (SALES_LOG_CHANNEL_ID)');
        }

        // 5. Ask the customer for a review.
        try {
            await customer.send({
                embeds: [
                    {
                        color: storeConfig.colors.review,
                        title: 'Thank you for your purchase!',
                        description:
                            `Your order of **${robux.toLocaleString('en-US')} Robux** has been logged.\n\n` +
                            'If you were happy with the service, please leave a quick review in the server with `/review`.',
                        footer: storeFooter(),
                    },
                ],
            });
            notes.push('Review reminder sent to the customer');
        } catch (error) {
            logger.warn(`sale: could not DM customer ${customer.id}: ${error.message}`);
            notes.push("Couldn't DM the customer (their DMs are closed)");
        }

        await InteractionHelper.safeEditReply(interaction, {
            content:
                `✅ Sale #${sale.id} logged: ${robux.toLocaleString('en-US')} Robux for ${customer} ` +
                `(their purchase #${customerPurchases}).\n` +
                notes.map((note) => `• ${note}`).join('\n'),
            allowedMentions: { parse: [] },
        });
    },
};
