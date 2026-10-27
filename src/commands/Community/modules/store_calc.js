import { MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { storeConfig, storeFooter } from '../../../config/store.js';
import { formatNumber, pkrForRobux, robuxForPkr } from '../../../services/rateCalculator.js';

export default {
    async execute(interaction) {
        const robux = interaction.options.getInteger('robux');
        const pkr = interaction.options.getNumber('pkr');
        const methodKey = interaction.options.getString('method');
        const isPublic = interaction.options.getBoolean('public') ?? false;
        const flags = isPublic ? undefined : MessageFlags.Ephemeral;

        if ((robux === null) === (pkr === null)) {
            await InteractionHelper.safeReply(interaction, {
                content: '❌ Enter either `robux` or `pkr` (not both, and not neither).',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const currency = storeConfig.rateCurrency;
        const rates = methodKey
            ? storeConfig.rates.filter((entry) => entry.key === methodKey)
            : storeConfig.rates;

        const lines = rates.map((entry) => {
            const result =
                robux !== null
                    ? `${formatNumber(pkrForRobux(robux, entry.rate))} ${currency}`
                    : `${formatNumber(robuxForPkr(pkr, entry.rate))} Robux`;
            return { name: `${entry.name} (${entry.rate} ${currency}/Robux)`, value: `**${result}**` };
        });

        const embed = {
            color: storeConfig.colors.stats,
            title: '★ Rate Calculator',
            description:
                robux !== null
                    ? `**${formatNumber(robux)} Robux** costs:`
                    : `**${formatNumber(pkr)} ${currency}** gets you:`,
            fields: [...lines, { name: '💳 Payment', value: `We accept ${storeConfig.paymentNote}.` }],
            footer: storeFooter(),
        };

        await InteractionHelper.safeReply(interaction, { embeds: [embed], ...(flags ? { flags } : {}) });
    },
};
