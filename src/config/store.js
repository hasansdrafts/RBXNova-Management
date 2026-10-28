// Store settings for the review / sales / vouch features.
// Every ID can be overridden from the .env file (comma-separated for lists).

function idList(envName, fallback = []) {
    const raw = process.env[envName];
    if (!raw) return fallback;
    return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

export const storeConfig = {
    // Your main server. It keeps the defaults below without any setup.
    // Every other server starts empty and is configured with /store setup.
    // (.env: STORE_HOME_GUILD_ID, otherwise GUILD_ID)
    homeGuildId: process.env.STORE_HOME_GUILD_ID || process.env.GUILD_ID || '1559922525415276614',

    // Defaults for the home server. Anything set with /store setup overrides these.
    homeDefaults: {
        // Staff roles allowed to use /store sale, stats and the void commands.
        // (.env: SALE_ROLE_IDS, comma-separated)
        staffRoleIds: idList('SALE_ROLE_IDS', [
            '1560212834871148635',
            '1560981749801033749',
            '1560190565478309898',
        ]),

        // Roles allowed to use /review. (.env: REVIEW_ROLE_IDS, comma-separated)
        reviewRoleIds: idList('REVIEW_ROLE_IDS', [
            '1560212834871148635',
            '1560981749801033749',
            '1560190565478309898',
        ]),

        // Channel where every review is posted. (.env: REVIEW_CHANNEL_ID)
        reviewChannelId: process.env.REVIEW_CHANNEL_ID || '1560194659387572224',

        // Private staff channel where every logged sale is posted.
        // (.env: SALES_LOG_CHANNEL_ID) If empty, sales are saved but not posted anywhere.
        salesLogChannelId: process.env.SALES_LOG_CHANNEL_ID || '',

        // Channel for vouches. (.env: VOUCH_CHANNEL_ID)
        // If empty, the bot looks for a channel with "vouches" in its name.
        vouchChannelId: process.env.VOUCH_CHANNEL_ID || '',

        // Role given to customers when a sale is logged for them. (.env: BUYER_ROLE_ID)
        // If empty, the bot looks for a role named "Buyer" or "Buyers".
        buyerRoleId: process.env.BUYER_ROLE_ID || '',
    },

    buyerRoleNames: ['buyer', 'buyers'],
    vouchChannelNameHint: 'vouches',

    // Customer milestones: when a customer reaches `purchases` logged sales they get the
    // role (use `roleId`, or leave it empty to find an existing role with this `roleName`).
    // The bot never creates roles. If no role is found, the milestone is still announced.
    milestones: [
        { purchases: 3, roleName: 'Bronze Customer', roleId: '' },
        { purchases: 5, roleName: 'Silver Customer', roleId: '' },
        { purchases: 10, roleName: 'Gold Customer', roleId: '' },
        { purchases: 25, roleName: 'VIP Customer', roleId: '' },
    ],

    // Price list used by /store calc. `rate` is how much PKR 1 Robux costs.
    // To change a price, edit the number here (keep `key` the same).
    rates: [
        { key: 'group', name: 'Group Payouts', rate: 1.9 },
        { key: 'plus', name: 'Roblox Plus (Subscription)', rate: 2.1 },
        { key: 'gifting', name: 'Ingame Gifting', rate: 1.5 },
        { key: 'gamepass', name: 'Gamepass (Not Tax Covered)', rate: 1.4 },
        { key: 'gamepass_tax', name: 'Gamepass (Tax Covered)', rate: 1.9 },
    ],
    rateCurrency: 'PKR',
    paymentNote: 'PKR or crypto currency',

    // Timezone for dates shown in embeds.
    timezone: 'Asia/Karachi',

    // Embed colors.
    colors: {
        review: 0xeb459e,
        sale: 0x57f287,
        stats: 0x5865f2,
        vouch: 0xfee75c,
    },

    footer: 'RBXNova • Robux Store',
};

export function formatStoreDateTime(date = new Date()) {
    const datePart = new Intl.DateTimeFormat('en-US', {
        timeZone: storeConfig.timezone,
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
    }).format(date);

    const timePart = new Intl.DateTimeFormat('en-US', {
        timeZone: storeConfig.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
        .format(date)
        .replace(/ /g, ' ');

    return `${datePart} ${timePart}`;
}

export function storeFooter() {
    return { text: `${storeConfig.footer} | ${formatStoreDateTime()}` };
}
