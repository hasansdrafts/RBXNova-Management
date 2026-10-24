import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter } from '../../../config/store.js';
import { getReviews, summarizeReviews } from '../../../services/storeService.js';

function bar(share) {
    const filled = Math.round(share * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export default {
    async execute(interaction, config, client) {
        const handler = interaction.options.getUser('handler');

        let reviews;
        try {
            reviews = await getReviews(client, interaction.guildId);
        } catch (error) {
            logger.error('reviewstats: could not load reviews:', error);
            await InteractionHelper.safeReply(interaction, {
                content: '❌ I could not load the reviews right now. Please try again later.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (handler) {
            reviews = reviews.filter((review) => review.handlerId === handler.id);
        }

        if (reviews.length === 0) {
            await InteractionHelper.safeReply(interaction, {
                content: handler ? `${handler} has no reviews yet.` : 'There are no reviews yet.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
            return;
        }

        const { count, average, distribution } = summarizeReviews(reviews);

        const breakdown = [5, 4, 3, 2, 1]
            .map((stars) => {
                const amount = distribution[stars];
                const share = amount / count;
                return `${stars}⭐ ${bar(share)} ${amount} (${Math.round(share * 100)}%)`;
            })
            .join('\n');

        const embed = {
            color: storeConfig.colors.stats,
            title: '★ Review Stats',
            description: handler ? `Reviews for ${handler}` : 'All customer reviews',
            fields: [
                { name: '⭐ Average Rating', value: `${average.toFixed(2)} / 5`, inline: true },
                { name: '📝 Total Reviews', value: `${count}`, inline: true },
                { name: '📊 Breakdown', value: breakdown },
            ],
            footer: storeFooter(),
        };

        await InteractionHelper.safeReply(interaction, {
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
