import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter, memberHasAnyRole } from '../../../config/store.js';
import { filterSalesByPeriod, getSales, topBy } from '../../../services/storeService.js';

const PERIOD_LABELS = {
    today: 'Today',
    week: 'Last 7 days',
    month: 'This month',
    all: 'All time',
};

function formatList(entries, unit) {
    if (entries.length === 0) return 'No data.';
    return entries
        .map((entry, index) => `**${index + 1}.** <@${entry.id}> — ${unit(entry)}`)
        .join('\n');
}

export default {
    async execute(interaction, config, client) {
        if (!memberHasAnyRole(interaction.member, storeConfig.staffRoleIds)) {
            await InteractionHelper.safeReply(interaction, {
                content: "❌ You don't have the required role to use this command.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const period = interaction.options.getString('period') ?? 'all';

        let sales;
        try {
            sales = filterSalesByPeriod(await getSales(client, interaction.guildId), period);
        } catch (error) {
            logger.error('salestats: could not load sales:', error);
            await InteractionHelper.safeReply(interaction, {
                content: '❌ I could not load the sales right now. Please try again later.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sales.length === 0) {
            await InteractionHelper.safeReply(interaction, {
                content: `No sales logged for: ${PERIOD_LABELS[period]}.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const totalRobux = sales.reduce((sum, sale) => sum + (Number(sale.robux) || 0), 0);
        const uniqueCustomers = new Set(sales.map((sale) => sale.customerId)).size;

        const topHandlers = topBy(sales, 'handlerId', (sale) => Number(sale.robux) || 0);
        const topCustomers = topBy(sales, 'customerId', (sale) => Number(sale.robux) || 0);

        const embed = {
            color: storeConfig.colors.stats,
            title: `★ Sales Stats — ${PERIOD_LABELS[period]}`,
            fields: [
                { name: '🛒 Total Sales', value: `${sales.length}`, inline: true },
                { name: '📦 Robux Sold', value: `${totalRobux.toLocaleString('en-US')}`, inline: true },
                { name: '🎓 Unique Customers', value: `${uniqueCustomers}`, inline: true },
                {
                    name: '🔧 Top Handlers',
                    value: formatList(
                        topHandlers,
                        (entry) => `${entry.count} sale${entry.count === 1 ? '' : 's'}, ${entry.value.toLocaleString('en-US')} Robux`,
                    ),
                },
                {
                    name: '🏆 Top Customers',
                    value: formatList(
                        topCustomers,
                        (entry) => `${entry.count} purchase${entry.count === 1 ? '' : 's'}, ${entry.value.toLocaleString('en-US')} Robux`,
                    ),
                },
            ],
            footer: storeFooter(),
        };

        await InteractionHelper.safeReply(interaction, {
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
};
