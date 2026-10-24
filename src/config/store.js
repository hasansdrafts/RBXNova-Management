// Store settings for the review / sales / vouch features.
// Every ID can be overridden from the .env file (comma-separated for lists).

function idList(envName, fallback = []) {
    const raw = process.env[envName];
    if (!raw) return fallback;
    return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

export const storeConfig = {
    // Staff roles allowed to use /sale and /salestats.
    // (.env: SALE_ROLE_IDS) Defaults to the same three roles allowed to use /review.
    staffRoleIds: idList('SALE_ROLE_IDS', [
        '1560212834871148635',
        '1560981749801033749',
        '1560190565478309898',
    ]),

    // Role given to customers when a sale is logged for them.
    // (.env: BUYER_ROLE_ID) If empty, the bot looks for a role named "Buyer" or "Buyers".
    buyerRoleId: process.env.BUYER_ROLE_ID || '',
    buyerRoleNames: ['buyer', 'buyers'],

    // Private staff channel where every logged sale is posted.
    // (.env: SALES_LOG_CHANNEL_ID) If empty, sales are saved but not posted anywhere.
    salesLogChannelId: process.env.SALES_LOG_CHANNEL_ID || '',

    // Channel for /vouch posts.
    // (.env: VOUCH_CHANNEL_ID) If empty, the bot looks for a channel with "vouches" in its name.
    vouchChannelId: process.env.VOUCH_CHANNEL_ID || '',
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

export function memberHasAnyRole(member, roleIds) {
    const roles = member?.roles;
    return roleIds.some((roleId) =>
        Array.isArray(roles) ? roles.includes(roleId) : Boolean(roles?.cache?.has(roleId)),
    );
}
