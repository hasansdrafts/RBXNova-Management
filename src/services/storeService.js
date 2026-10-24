// storeService.js — storage and helpers for reviews, sales, milestones and vouches.

import { PermissionFlagsBits } from 'discord.js';
import { storeConfig } from '../config/store.js';
import { unwrapReplitData } from '../utils/database/guildConfigStorage.js';
import { logger } from '../utils/logger.js';

const reviewsKey = (guildId) => `guild:${guildId}:store:reviews`;
const salesKey = (guildId) => `guild:${guildId}:store:sales`;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const locks = new Map();

// Runs read-modify-write operations one at a time per key so two staff members
// logging at the same moment can't overwrite each other.
function withLock(key, fn) {
    const previous = locks.get(key) || Promise.resolve();
    const run = previous.then(() => fn());
    locks.set(key, run.catch(() => {}));
    return run;
}

async function readList(client, key) {
    if (!client?.db || typeof client.db.get !== 'function') {
        throw new Error('Database is unavailable');
    }
    const raw = await client.db.get(key, []);
    const data = unwrapReplitData(raw);
    return Array.isArray(data) ? data : [];
}

async function writeList(client, key, list) {
    const saved = await client.db.set(key, list);
    if (!saved) {
        throw new Error('Database rejected the write');
    }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function getReviews(client, guildId) {
    return readList(client, reviewsKey(guildId));
}

/**
 * Saves a review. Returns { duplicate: true } if that ticket already has a review.
 */
export function addReview(client, guildId, review) {
    return withLock(reviewsKey(guildId), async () => {
        const reviews = await readList(client, reviewsKey(guildId));

        if (reviews.some((entry) => Number(entry.ticketId) === Number(review.ticketId))) {
            return { duplicate: true };
        }

        const saved = { ...review, at: new Date().toISOString() };
        reviews.push(saved);
        await writeList(client, reviewsKey(guildId), reviews);
        return { duplicate: false, review: saved };
    });
}

export function summarizeReviews(reviews) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    for (const review of reviews) {
        const rating = Number(review.rating);
        if (rating >= 1 && rating <= 5) {
            distribution[rating] += 1;
            total += rating;
        }
    }

    const count = reviews.length;
    return { count, average: count ? total / count : 0, distribution };
}

export function rankHandlersByRating(reviews) {
    const byHandler = new Map();

    for (const review of reviews) {
        if (!review.handlerId) continue;
        const entry = byHandler.get(review.handlerId) || { handlerId: review.handlerId, count: 0, total: 0 };
        entry.count += 1;
        entry.total += Number(review.rating) || 0;
        byHandler.set(review.handlerId, entry);
    }

    return [...byHandler.values()]
        .map((entry) => ({ ...entry, average: entry.total / entry.count }))
        .sort((a, b) => b.average - a.average || b.count - a.count);
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export function getSales(client, guildId) {
    return readList(client, salesKey(guildId));
}

/**
 * Saves a sale and returns it along with the customer's total number of purchases.
 */
export function addSale(client, guildId, sale) {
    return withLock(salesKey(guildId), async () => {
        const sales = await readList(client, salesKey(guildId));
        const nextId = sales.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0) + 1;

        const saved = { ...sale, id: nextId, at: new Date().toISOString() };
        sales.push(saved);
        await writeList(client, salesKey(guildId), sales);

        const customerPurchases = sales.filter((entry) => entry.customerId === saved.customerId).length;
        return { sale: saved, customerPurchases };
    });
}

function dateKey(date) {
    // en-CA gives YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: storeConfig.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

export function filterSalesByPeriod(sales, period) {
    if (period === 'all') return sales;

    const now = new Date();
    let startKey;

    if (period === 'today') {
        startKey = dateKey(now);
    } else if (period === 'week') {
        startKey = dateKey(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    } else {
        // month
        startKey = `${dateKey(now).slice(0, 7)}-01`;
    }

    return sales.filter((sale) => dateKey(new Date(sale.at)) >= startKey);
}

export function topBy(items, keyField, valueFn = () => 1, limit = 5) {
    const totals = new Map();
    for (const item of items) {
        const key = item[keyField];
        if (!key) continue;
        const entry = totals.get(key) || { id: key, count: 0, value: 0 };
        entry.count += 1;
        entry.value += valueFn(item);
        totals.set(key, entry);
    }
    return [...totals.values()].sort((a, b) => b.value - a.value || b.count - a.count).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Roles and channels
// ---------------------------------------------------------------------------

function findRole(guild, { roleId, names = [] }) {
    if (roleId) {
        return guild.roles.cache.get(roleId) ?? null;
    }
    const wanted = names.map((name) => name.toLowerCase());
    return guild.roles.cache.find((role) => wanted.includes(role.name.toLowerCase())) ?? null;
}

async function giveRole(guild, userId, role) {
    if (!role) return 'no_role';

    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles) || role.managed || role.position >= me.roles.highest.position) {
        return 'cannot_manage';
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return 'not_in_server';
    if (member.roles.cache.has(role.id)) return 'already';

    try {
        await member.roles.add(role, 'RBXNova store: purchase logged');
        return 'added';
    } catch (error) {
        logger.warn(`Could not give role ${role.id} to ${userId}: ${error.message}`);
        return 'failed';
    }
}

export async function assignBuyerRole(guild, userId) {
    const role = findRole(guild, { roleId: storeConfig.buyerRoleId, names: storeConfig.buyerRoleNames });
    const status = await giveRole(guild, userId, role);
    return { status, role };
}

/**
 * Checks whether the customer just reached a milestone and gives the role if one exists.
 */
export async function applyMilestone(guild, userId, purchaseCount) {
    const tier = storeConfig.milestones.find((entry) => entry.purchases === purchaseCount);
    if (!tier) return null;

    const role = findRole(guild, { roleId: tier.roleId, names: [tier.roleName] });
    const status = await giveRole(guild, userId, role);
    return { tier, role, status };
}

export async function getTextChannel(guild, channelId) {
    if (!channelId) return null;
    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
    return channel?.isTextBased() ? channel : null;
}

export async function getVouchChannel(guild) {
    if (storeConfig.vouchChannelId) {
        return getTextChannel(guild, storeConfig.vouchChannelId);
    }
    const hint = storeConfig.vouchChannelNameHint.toLowerCase();
    return (
        guild.channels.cache.find((channel) => channel.isTextBased() && channel.name.toLowerCase().includes(hint)) ?? null
    );
}
