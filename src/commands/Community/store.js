import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import storeSale from './modules/store_sale.js';
import storeSaleStats from './modules/store_salestats.js';
import storeReviewStats from './modules/store_reviewstats.js';
import storeHandlerBoard from './modules/store_handlerboard.js';
import storeVouch from './modules/store_vouch.js';

// All store tools live under one /store command because Discord allows at most
// 100 global slash commands and the bot is at that limit.
const HANDLERS = {
    sale: storeSale,
    stats: storeSaleStats,
    reviews: storeReviewStats,
    leaderboard: storeHandlerBoard,
    vouch: storeVouch,
};

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('store')
        .setDescription('Store tools: sales, review stats, leaderboard and vouches')
        .setDMPermission(false)
        .addSubcommand((sub) =>
            sub
                .setName('sale')
                .setDescription('Staff only: log a completed sale.')
                .addUserOption((option) =>
                    option.setName('customer').setDescription('The customer who bought').setRequired(true),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('robux')
                        .setDescription('Amount of Robux sold (numbers only)')
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addStringOption((option) =>
                    option
                        .setName('price')
                        .setDescription('What they paid, e.g. "$10" or "2000 PKR" (optional)')
                        .setRequired(false)
                        .setMaxLength(50),
                )
                .addUserOption((option) =>
                    option
                        .setName('handler')
                        .setDescription('Staff member who handled the sale (defaults to you)')
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('ticket_id')
                        .setDescription('Ticket number for this sale (optional)')
                        .setRequired(false)
                        .setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('stats')
                .setDescription('Staff only: show sales totals and top handlers/customers.')
                .addStringOption((option) =>
                    option
                        .setName('period')
                        .setDescription('Time range (defaults to all time)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Today', value: 'today' },
                            { name: 'Last 7 days', value: 'week' },
                            { name: 'This month', value: 'month' },
                            { name: 'All time', value: 'all' },
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('reviews')
                .setDescription('Show customer review statistics.')
                .addUserOption((option) =>
                    option
                        .setName('handler')
                        .setDescription('Only show reviews for this staff member')
                        .setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('leaderboard')
                .setDescription('Show the staff leaderboard (best rated and most sales).'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('vouch')
                .setDescription('Leave a quick vouch for a staff member.')
                .addUserOption((option) =>
                    option.setName('user').setDescription('Who you want to vouch for').setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription('Your vouch message')
                        .setRequired(true)
                        .setMinLength(3)
                        .setMaxLength(300),
                ),
        ),
    category: 'Community',

    async execute(interaction, config, client) {
        const handler = HANDLERS[interaction.options.getSubcommand()];

        if (!handler) {
            await InteractionHelper.safeReply(interaction, {
                content: '❌ Unknown subcommand.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        return handler.execute(interaction, config, client);
    },
};
