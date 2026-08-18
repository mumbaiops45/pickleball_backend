/**
 * Controllers hand every failure to `next(error)`. Without a
 * terminal error handler Express replies with an HTML stack
 * trace, so this converts errors into the same JSON envelope
 * the rest of the API uses.
 *
 * Services throw plain `Error`s with human messages, so the
 * status code is inferred from the message unless the error
 * carries an explicit `statusCode`.
 */
const inferStatusCode = (error) => {
    if (error.statusCode || error.status) {
        return error.statusCode || error.status;
    }

    if (error.name === "ValidationError") {
        return 400;
    }

    if (error.name === "CastError") {
        return 400;
    }

    if (error.code === 11000) {
        return 409;
    }

    const message = (error.message || "").toLowerCase();

    if (message.includes("not found")) {
        return 404;
    }

    if (message.includes("already exists")) {
        return 409;
    }

    if (
        message.includes("required") ||
        message.includes("invalid") ||
        message.includes("must be") ||
        message.includes("missing") ||
        message.includes("insufficient") ||
        message.includes("is empty") ||
        message.includes("cannot be") ||
        message.includes("not available") ||
        message.includes("already")
    ) {
        return 400;
    }

    return 500;
};

export const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
    const statusCode = inferStatusCode(error);

    if (statusCode >= 500) {
        console.error("Unhandled error:", error);
    }

    res.status(statusCode).json({
        success: false,
        message: error.message || "Something went wrong",
        ...(error.code === 11000
            ? { duplicateFields: Object.keys(error.keyValue || {}) }
            : {})
    });
};
