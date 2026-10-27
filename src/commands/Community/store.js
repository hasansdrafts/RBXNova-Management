import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import storeSale from './modules/store_sale.js';
import storeSaleStats from './modules/store_salestats.js';
import storeReviewStats from './modules/store_reviewstats.js';
import storeHandlerBoard from './modules/store_handlerboard.js';
import storeVouch from './modules/store_vouch.js';
import storeVoid from './modules/store_void.js';
import storeCalc from './modules/store_calc.js';
import { storeConfig } from '../../config/store.js';

// All store tools live under one /store command because Discord allows at most
// 100 global slash commands and the bot is at that limit.
const HANDLERS = {
    sale: storeSale,
    stats: storeSaleStats,
    reviews: storeReviewStats,
    leaderboard: storeHandlerBoard,
    vouch: storeVouch,
    'void-sale': storeVoid,
    'void-review': storeVoid,
    'void-vouch': storeVoid,
    calc: storeCalc,
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
        )
        .addSubcommand((sub) =>
            sub
                .setName('calc')
                .setDescription('Rate calculator: see what Robux costs, or how much Robux you get.')
                .addIntegerOption((option) =>
                    option
                        .setName('robux')
                        .setDescription('How many Robux you want (shows the price)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(100000000),
                )
                .addNumberOption((option) =>
                    option
                        .setName('pkr')
                        .setDescription('How much PKR you have (shows how many Robux you get)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(1000000000),
                )
                .addStringOption((option) =>
                    option
                        .setName('method')
                        .setDescription('Only show one method (default: all methods)')
                        .setRequired(false)
                        .addChoices(...storeConfig.rates.map((entry) => ({ name: entry.name, value: entry.key }))),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('public')
                        .setDescription('Show the result to everyone in the channel (default: only you)')
                        .setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('void-sale')
                .setDescription('Staff only: void a logged sale.')
                .addIntegerOption((option) =>
                    option
                        .setName('sale_id')
                        .setDescription('The sale number shown in the sales log (e.g. 12)')
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Why it is being voided (optional)')
                        .setRequired(false)
                        .setMaxLength(200),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('void-review')
                .setDescription('Staff only: void a posted review.')
                .addIntegerOption((option) =>
                    option
                        .setName('ticket_id')
                        .setDescription('The ticket number of the review')
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Why it is being voided (optional)')
                        .setRequired(false)
                        .setMaxLength(200),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('void-vouch')
                .setDescription('Staff only: void a posted vouch.')
                .addIntegerOption((option) =>
                    option
                        .setName('vouch_id')
                        .setDescription('The vouch number shown in its title (e.g. 5)')
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Why it is being voided (optional)')
                        .setRequired(false)
                        .setMaxLength(200),
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
