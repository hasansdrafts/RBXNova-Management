import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter } from '../../../config/store.js';
import { getVouchChannel } from '../../../services/storeService.js';

export default {
    async execute(interaction, config, client) {
        const target = interaction.options.getUser('user');
        const message = interaction.options.getString('message').trim();

        if (target.bot || target.id === interaction.user.id) {
            await InteractionHelper.safeReply(interaction, {
                content: "❌ You can't vouch for yourself or a bot.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        // Built as a plain embed object so emojis and the footer are kept.
        const embed = {
            color: storeConfig.colors.vouch,
            title: '★ New Vouch',
            fields: [
                { name: '🎓 From', value: `${interaction.user}`, inline: true },
                { name: '🔧 For', value: `${target}`, inline: true },
                { name: '📝 Vouch', value: `> ${message}` },
            ],
            footer: storeFooter(),
        };

        try {
            const channel = await getVouchChannel(interaction.guild);
            if (!channel) {
                throw new Error('Vouch channel not found (set VOUCH_CHANNEL_ID)');
            }
            await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (error) {
            logger.error('vouch: could not post vouch:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: "❌ I couldn't post your vouch. Please let a staff member know.",
            });
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            content: '✅ Your vouch has been posted. Thank you!',
        });
    },
};
