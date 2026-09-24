import crypto from "crypto";
import jwt from "jsonwebtoken";
import RefreshToken from "../models/refreshToken.model.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

// The cookie is only ever sent to the refresh/logout routes.
const REFRESH_COOKIE_PATH = "/api/auth";

const getRefreshTokenDays = () =>
    Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 30;

const hashToken = (token) =>
    crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

export const signAccessToken = (user) =>
    jwt.sign(
        {
            id: user._id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "15m"
        }
    );

export const issueRefreshToken = async ({
    userId,
    req
}) => {
    const token = crypto.randomBytes(48).toString("hex");

    const expiresAt = new Date(
        Date.now() +
            getRefreshTokenDays() * 24 * 60 * 60 * 1000
    );

    await RefreshToken.create({
        tokenHash: hashToken(token),
        user: userId,
        expiresAt,
        userAgent: req?.headers?.["user-agent"] || null,
        ip: req?.ip || null
    });

    return {
        token,
        expiresAt
    };
};

/**
 * Rotation: every refresh burns the old token and issues a new
 * one. If a token that was already rotated out comes back, the
 * cookie was stolen and replayed, so every session for that
 * user is revoked.
 */
export const rotateRefreshToken = async ({
    token,
    req
}) => {
    if (!token) {
        throw new Error("Refresh token is required");
    }

    const stored = await RefreshToken.findOne({
        tokenHash: hashToken(token)
    });

    if (!stored) {
        throw new Error("Invalid refresh token");
    }

    if (stored.revokedAt) {
        await RefreshToken.updateMany(
            {
                user: stored.user,
                revokedAt: null
            },
            {
                revokedAt: new Date()
            }
        );

        throw new Error(
            "Refresh token reuse detected. Please sign in again"
        );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
        throw new Error("Refresh token has expired");
    }

    const next = await issueRefreshToken({
        userId: stored.user,
        req
    });

    stored.revokedAt = new Date();
    stored.replacedByHash = hashToken(next.token);

    await stored.save();

    return {
        userId: stored.user,
        ...next
    };
};

export const revokeRefreshToken = async (token) => {
    if (!token) {
        return;
    }

    await RefreshToken.findOneAndUpdate(
        {
            tokenHash: hashToken(token),
            revokedAt: null
        },
        {
            revokedAt: new Date()
        }
    );
};

export const revokeAllRefreshTokens = async (userId) => {
    await RefreshToken.updateMany(
        {
            user: userId,
            revokedAt: null
        },
        {
            revokedAt: new Date()
        }
    );
};

/**
 * The storefront and admin panel are on different sites from
 * the API, so the cookie has to be SameSite=None in production
 * — which browsers only accept together with Secure.
 */
const getCookieOptions = () => {
    const isProduction =
        process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: REFRESH_COOKIE_PATH
    };
};

export const setRefreshCookie = (res, { token, expiresAt }) => {
    res.cookie(REFRESH_COOKIE_NAME, token, {
        ...getCookieOptions(),
        expires: expiresAt
    });
};

export const clearRefreshCookie = (res) => {
    res.clearCookie(
        REFRESH_COOKIE_NAME,
        getCookieOptions()
    );
};
