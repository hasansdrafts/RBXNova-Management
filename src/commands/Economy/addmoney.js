import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { isBotOwner } from '../../config/bot.js';
import { addMoney, formatCurrency } from '../../utils/economy.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('addmoney')
        .setDescription('Bot owner only: add money to a user.')
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName('amount')
                .setDescription('How much money to add')
                .setRequired(true)
                .setMinValue(1),
        )
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('Who receives the money (defaults to you)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription('Where to add it (defaults to wallet)')
                .setRequired(false)
                .addChoices(
                    { name: 'Wallet', value: 'wallet' },
                    { name: 'Bank', value: 'bank' },
                ),
        ),
    category: 'Economy',

    async execute(interaction, config, client) {
        if (!isBotOwner(interaction.user.id)) {
            await InteractionHelper.safeReply(interaction, {
                content: '❌ Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('user') ?? interaction.user;
        const type = interaction.options.getString('type') ?? 'wallet';

        try {
            const result = await addMoney(client, interaction.guildId, target.id, amount, type);

            logger.info(
                `Owner ${interaction.user.id} added ${amount} to ${type} of ${target.id} in guild ${interaction.guildId}`,
            );

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Added ${formatCurrency(amount)} to ${target}'s ${type}. New ${type} balance: ${formatCurrency(result.newBalance)}.`,
            });
        } catch (error) {
            logger.error('addmoney failed:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: `❌ ${error?.userMessage || 'Failed to add money.'}`,
            });
        }
    },
};
