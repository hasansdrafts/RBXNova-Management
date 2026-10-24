import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter } from '../../../config/store.js';
import { getReviews, getSales, rankHandlersByRating, topBy } from '../../../services/storeService.js';

const MEDALS = ['🥇', '🥈', '🥉'];

function rankLabel(index) {
    return MEDALS[index] ?? `**${index + 1}.**`;
}

export default {
    async execute(interaction, config, client) {
        let reviews;
        let sales;
        try {
            [reviews, sales] = await Promise.all([
                getReviews(client, interaction.guildId),
                getSales(client, interaction.guildId),
            ]);
        } catch (error) {
            logger.error('handlerboard: could not load data:', error);
            await InteractionHelper.safeReply(interaction, {
                content: '❌ I could not load the leaderboard right now. Please try again later.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const bestRated = rankHandlersByRating(reviews).slice(0, 10);
        const mostSales = topBy(sales, 'handlerId', () => 1, 10);

        if (bestRated.length === 0 && mostSales.length === 0) {
            await InteractionHelper.safeReply(interaction, {
                content: 'There is no data for the leaderboard yet.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const ratedText = bestRated.length
            ? bestRated
                .map(
                    (entry, index) =>
                        `${rankLabel(index)} <@${entry.handlerId}> — **${entry.average.toFixed(2)}** ★ (${entry.count} review${entry.count === 1 ? '' : 's'})`,
                )
                .join('\n')
            : 'No reviews yet.';

        const salesText = mostSales.length
            ? mostSales
                .map(
                    (entry, index) =>
                        `${rankLabel(index)} <@${entry.id}> — **${entry.count}** sale${entry.count === 1 ? '' : 's'}`,
                )
                .join('\n')
            : 'No sales logged yet.';

        const embed = {
            color: storeConfig.colors.stats,
            title: '★ Handler Leaderboard',
            fields: [
                { name: '⭐ Best Rated', value: ratedText },
                { name: '📦 Most Sales Handled', value: salesText },
            ],
            footer: storeFooter(),
        };

        await InteractionHelper.safeReply(interaction, {
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
