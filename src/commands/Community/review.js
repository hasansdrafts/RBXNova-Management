import { SlashCommandBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// Timezone used for the date/time shown in the embed footer.
const REVIEW_TIMEZONE = 'Asia/Karachi';

// Footer text. The date and time are added after the "|".
const FOOTER_PREFIX = 'RBXNova • Robux Store';

// Left-hand border color of the embed (pink).
const REVIEW_COLOR = 0xeb459e;

function formatDateTime(date = new Date()) {
    const datePart = new Intl.DateTimeFormat('en-US', {
        timeZone: REVIEW_TIMEZONE,
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
    }).format(date);

    const timePart = new Intl.DateTimeFormat('en-US', {
        timeZone: REVIEW_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
        .format(date)
        .replace(/ /g, ' ');

    return `${datePart} ${timePart}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Leave a review for the staff member who handled your ticket.')
        .addUserOption((option) =>
            option
                .setName('handler')
                .setDescription('The staff member who handled your ticket')
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName('rating')
                .setDescription('Your rating (stars)')
                .setRequired(true)
                .addChoices(
                    { name: '⭐⭐⭐⭐⭐ (5)', value: 5 },
                    { name: '⭐⭐⭐⭐ (4)', value: 4 },
                    { name: '⭐⭐⭐ (3)', value: 3 },
                    { name: '⭐⭐ (2)', value: 2 },
                    { name: '⭐ (1)', value: 1 },
                ),
        )
        .addIntegerOption((option) =>
            option
                .setName('ticket_id')
                .setDescription('Your ticket ID number')
                .setRequired(true)
                .setMinValue(1),
        )
        .addIntegerOption((option) =>
            option
                .setName('robux')
                .setDescription('What they bought: amount of Robux (numbers only)')
                .setRequired(true)
                .setMinValue(1),
        )
        .addStringOption((option) =>
            option
                .setName('review')
                .setDescription('Leave a small written review (optional)')
                .setRequired(false)
                .setMaxLength(200),
        ),
    category: 'Community',

    async execute(interaction, config, client) {
        const handler = interaction.options.getUser('handler');
        const rating = interaction.options.getInteger('rating');
        const ticketId = interaction.options.getInteger('ticket_id');
        const robux = interaction.options.getInteger('robux');
        const reviewText = interaction.options.getString('review')?.trim();

        const fields = [
            { name: '🎓 Customer', value: `${interaction.user}` },
            { name: '🔧 Handler', value: `${handler}` },
            { name: '📦 What They Bought', value: `${robux} Robux` },
            { name: 'Rating', value: `${'⭐'.repeat(rating)} ${rating} / 5` },
        ];

        if (reviewText) {
            fields.push({ name: '📝 Review', value: `> ${reviewText}` });
        }

        // Built as a plain embed object on purpose: the bot's global EmbedBuilder
        // patches (src/utils/embeds.js) strip emojis and drop custom footers.
        const embed = {
            color: REVIEW_COLOR,
            title: `${'★'.repeat(rating)} New Review — Ticket #${ticketId}`,
            fields,
            footer: { text: `${FOOTER_PREFIX} | ${formatDateTime()}` },
        };

        await InteractionHelper.safeReply(interaction, { embeds: [embed] });

        logger.debug(
            `Review submitted by ${interaction.user.id} for ticket ${ticketId} (handler ${handler.id}, robux ${robux}, rating ${rating}) in guild ${interaction.guildId}`,
        );
    },
};
