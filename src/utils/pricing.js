/**
 * The price a shopper actually pays for one unit.
 *
 * The admin saves `discountPrice: 0` for a product that is not on
 * offer, so `discountPrice ?? price` resolved to 0 and every such
 * product went into the cart and the order for free. A discount only
 * counts when it is a real, lower, positive number.
 */
export const sellingPrice = (product) => {
    const price = Number(product?.price) || 0;
    const discount = Number(product?.discountPrice);

    if (discount > 0 && discount < price) {
        return discount;
    }

    return price;
};
