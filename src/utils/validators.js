/**
 * The same rules the storefront forms enforce, repeated here because a
 * request does not have to come from those forms.
 */
// name@domain.tld — no leading/trailing dot, no "..", a 2+ letter TLD.
export const EMAIL_REGEX =
    /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

// Letters (any script), spaces and . ' - ; no digits or symbols.
export const NAME_REGEX = /^[\p{L}][\p{L}\p{M}\s.'’-]*$/u;

export const NAME_MAX = 50;

// Misspellings of the big providers: mail sent there bounces.
const DOMAIN_TYPOS = new Set([
    "gmail.co", "gmail.con", "gmail.cm", "gmail.om", "gmail.cmo", "gmail.in",
    "gmial.com", "gmai.com", "gamil.com", "gnail.com", "gmaill.com", "gmal.com",
    "yahoo.con", "yaho.com", "yahooo.com",
    "hotmail.con", "hotmial.com",
    "outlook.con", "outlok.com",
    "rediffmail.con"
]);

/** First problem with a person's name, or null. */
export const nameProblem = (value) => {
    const name = String(value ?? "").trim();

    if (!name) return "Name is required";
    if (/\d/.test(name)) return "Name cannot contain numbers";
    if (!NAME_REGEX.test(name)) return "Name can only contain letters";
    if (name.replace(/[^\p{L}]/gu, "").length < 2) return "Name must be at least 2 letters";
    if (name.length > NAME_MAX) return `Name must be under ${NAME_MAX} characters`;

    return null;
};

/** First problem with an email, or null. `typos` also rejects misspelt providers. */
export const emailProblem = (value, { typos = true } = {}) => {
    const email = String(value ?? "").trim();

    if (!email) return "Email is required";
    if (email.length > 254 || email.includes("..") || !EMAIL_REGEX.test(email)) {
        return "Enter a valid email address";
    }

    const domain = email.toLowerCase().split("@")[1];

    if (typos && (DOMAIN_TYPOS.has(domain) || domain.endsWith(".con"))) {
        return `Check the email domain — "${domain}" looks misspelt`;
    }

    return null;
};

// Indian mobile: 10 digits starting 6-9
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export const PINCODE_REGEX = /^\d{6}$/;

export const MIN_PASSWORD = 6;

const text = (value) => String(value ?? "").trim();

/** Returns the first problem with a registration, or null. */
export const registrationProblem = ({ name, email, phone, password }) => {
    if (name !== undefined) {
        const problem = nameProblem(name);
        if (problem) return problem;
    }

    if (!email && !phone) {
        return "Email or phone is required";
    }

    if (email) {
        const problem = emailProblem(email);
        if (problem) return problem;
    }

    if (phone && !PHONE_REGEX.test(text(phone))) {
        return "Enter a valid 10-digit mobile number";
    }

    if (!password) {
        return "Password is required";
    }

    if (String(password).length < MIN_PASSWORD) {
        return `Password must be at least ${MIN_PASSWORD} characters`;
    }

    return null;
};

/**
 * Returns the first problem with an address, or null. With `partial`
 * only the fields present are checked (an update may send a subset).
 */
export const addressProblem = (data, { partial = false } = {}) => {
    const has = (key) => !partial || data[key] !== undefined;

    const required = {
        fullName: "Full name",
        phone: "Mobile number",
        addressLine1: "Address",
        city: "City",
        state: "State",
        pincode: "Pincode"
    };

    for (const [key, label] of Object.entries(required)) {
        if (has(key) && !text(data[key])) {
            return `${label} is required`;
        }
    }

    if (has("fullName")) {
        const problem = nameProblem(data.fullName);
        if (problem) return problem.replace("Name", "Full name");
    }

    if (has("phone") && !PHONE_REGEX.test(text(data.phone))) {
        return "Enter a valid 10-digit mobile number";
    }

    if (has("pincode") && !PINCODE_REGEX.test(text(data.pincode))) {
        return "Enter a valid 6-digit pincode";
    }

    return null;
};
