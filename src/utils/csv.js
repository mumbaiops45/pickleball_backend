/**
 * Minimal RFC-4180 CSV writer. Reports are exported straight
 * from aggregation output, so no dependency is warranted.
 */
const escapeCell = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    const text = String(value);

    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
};

/**
 * @param {Array<{ key: string, label: string }>} columns
 * @param {Array<object>} rows
 */
export const toCsv = (columns, rows) => {
    const header = columns
        .map((column) => escapeCell(column.label))
        .join(",");

    const body = rows.map((row) =>
        columns
            .map((column) => escapeCell(row[column.key]))
            .join(",")
    );

    // Excel opens UTF-8 correctly only with a BOM.
    return `﻿${[header, ...body].join("\r\n")}\r\n`;
};

export const sendCsv = (res, filename, columns, rows) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");

    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
    );

    return res.status(200).send(toCsv(columns, rows));
};
