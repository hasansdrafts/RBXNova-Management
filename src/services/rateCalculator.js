// rateCalculator.js — pure helpers for the /store calc command.

/** PKR cost of `robux` at `rate` PKR per Robux, rounded to 2 decimals. */
export function pkrForRobux(robux, rate) {
    return Math.round(robux * rate * 100) / 100;
}

/** Whole Robux that `pkr` buys at `rate` PKR per Robux. */
export function robuxForPkr(pkr, rate) {
    return Math.floor(pkr / rate + 1e-9);
}

export function formatNumber(value) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
