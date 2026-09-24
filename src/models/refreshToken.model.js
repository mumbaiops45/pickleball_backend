import mongoose from "mongoose";

/**
 * Refresh tokens are opaque random strings, never JWTs: the
 * raw value only ever lives in the client cookie, and only its
 * SHA-256 hash is stored here. A database leak therefore hands
 * out nothing that can be replayed.
 */
const refreshTokenSchema = new mongoose.Schema(
    {
        tokenHash: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        revokedAt: {
            type: Date,
            default: null
        },

        // Set when this token is rotated out, so a replay of the
        // old value can be recognised as token theft.
        replacedByHash: {
            type: String,
            default: null
        },

        userAgent: {
            type: String,
            default: null
        },

        ip: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Mongo drops expired sessions on its own.
refreshTokenSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

const RefreshToken = mongoose.model(
    "RefreshToken",
    refreshTokenSchema
);

export default RefreshToken;
