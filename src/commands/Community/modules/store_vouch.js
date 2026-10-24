import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter } from '../../../config/store.js';
import { addVouch, getVouchChannel, updateVouch, voidVouch } from '../../../services/storeService.js';

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

        // Save first so the vouch gets a number that can be shown and used to void it.
        let vouch;
        try {
            vouch = await addVouch(client, interaction.guildId, {
                fromId: interaction.user.id,
                forId: target.id,
                text: message,
            });
        } catch (error) {
            logger.error('vouch: could not save vouch:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: "❌ I couldn't save your vouch. Please try again.",
            });
            return;
        }

        // Built as a plain embed object so emojis and the footer are kept.
        const embed = {
            color: storeConfig.colors.vouch,
            title: `★ New Vouch — #${vouch.id}`,
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
            const posted = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
            await updateVouch(client, interaction.guildId, vouch.id, {
                channelId: posted.channelId,
                messageId: posted.id,
            }).catch((error) => logger.warn(`vouch: could not save message id: ${error.message}`));
        } catch (error) {
            logger.error('vouch: could not post vouch:', error);
            // Don't keep a vouch that was never posted.
            await voidVouch(client, interaction.guildId, vouch.id, {
                by: 'system',
                reason: 'Could not be posted',
            }).catch(() => {});
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
