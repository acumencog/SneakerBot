const useProxy = require("puppeteer-page-proxy");

exports.getCaptchaSelector = () => {
    return 'div#g-recaptcha';
};

exports.guestCheckout = async (
    page,
    url,
    proxyString,
    styleIndex,
    size,
    shippingAddress,
    shippingSpeedIndex,
    billingAddress
) => {
    try {
        const domain = url.split("/").slice(0, 3).join("/");

        await useProxy(page, proxyString);
        await page.goto(url, { waitUntil: 'networkidle0' });

        const variantId = await page.evaluate((size) => {
            const variants = window.ShopifyAnalytics.meta.product.variants;
            return variants.find(variant => variant.name.endsWith(size)).id;
        }, size)

        const isInCart = await page.evaluate(async (variantId) => {
            const item = { id: variantId, quantity: 1 };

            const data = {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: [item]
                }),
            };

            const response = await fetch('/cart/add.js', data);
            if (response.status === 200) return true;
            return false;
        }, variantId);

        await page.waitForTimeout(2000);

        await page.goto(`${domain}/checkout`, { waitUntil: 'networkidle0' })

        let hasCaptcha = false;
        let checkoutComplete = false;
        if (isInCart) {
            const status = await checkout(page, shippingAddress, shippingSpeedIndex, billingAddress, domain);
            hasCaptcha = status.hasCaptcha;
            checkoutComplete = status.checkoutComplete;
        }

        return { isInCart, hasCaptcha, checkoutComplete };
    } catch (err) {
        console.error(err);
        throw new Error(err.message);
    }
};

async function checkout(
    page,
    shippingAddress,
    shippingSpeedIndex,
    billingAddress,
    domain
) {
    try {
        let hasCaptcha = false;
        let checkoutComplete = false;


        const cardDetails = {
            cardNumber: process.env.CARD_NUMBER,
            nameOnCard: process.env.NAME_ON_CARD,
            expirationMonth: process.env.EXPIRATION_MONTH,
            expirationYear: process.env.EXPIRATION_YEAR,
            securityCode: process.env.SECURITY_CODE
        };

        const captchaSelector = exports.getCaptchaSelector();
        const emailSelector = 'input#checkout_email';
        const submitButtonsSelector = "button#continue_button";

        const shippingSpeedsSelector = 'input[name="checkout[shipping_rate][id]"]';

        const cardFieldsIframeSelector = 'iframe.card-fields-iframe';
        const creditCardNumberSelector = "input#number";
        const nameOnCardSelector = "input#name";
        const creditCardExpirationDateSelector = "input#expiry";
        const creditCardCVVSelector = "input#verification_value";

        const differentBillingAddressSelector =
            "input#checkout_different_billing_address_true";

        try {
            await page.waitForSelector(captchaSelector);
            hasCaptcha = true;
            return { hasCaptcha, checkoutComplete };
        } catch (err) {
            // no-op if timeout occurs
        }

        await page.waitForSelector(emailSelector);
        await page.type(emailSelector, shippingAddress.email_address, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await enterAddressDetails(page, shippingAddress, 'shipping');

        await page.waitForSelector(submitButtonsSelector);
        await page.click(submitButtonsSelector);
        await page.waitForTimeout(2000);

        await page.waitForSelector(shippingSpeedsSelector);
        const shippingSpeeds = await page.$$(shippingSpeedsSelector);
        await shippingSpeeds[shippingSpeedIndex].click();
        await page.waitForTimeout(2000);


        await page.waitForSelector(submitButtonsSelector);
        await page.click(submitButtonsSelector);
        await page.waitForTimeout(2000);

        await page.waitForSelector(cardFieldsIframeSelector);
        const cardFieldIframes = await page.$$(cardFieldsIframeSelector);

        const cardNumberFrameHandle = cardFieldIframes[0];
        const cardNumberFrame = await cardNumberFrameHandle.contentFrame();
        await cardNumberFrame.waitForSelector(creditCardNumberSelector);
        await cardNumberFrame.type(
            creditCardNumberSelector,
            cardDetails.cardNumber,
            {
                delay: 10
            }
        );

        const nameOnCardFrameHandle = cardFieldIframes[1];
        const nameOnCardFrame = await nameOnCardFrameHandle.contentFrame();
        await nameOnCardFrame.waitForSelector(
            nameOnCardSelector
        );
        await nameOnCardFrame.type(
            nameOnCardSelector,
            cardDetails.nameOnCard,
            {
                delay: 10
            }
        );
        await page.waitForTimeout(2000);

        const cardExpirationDateFrameHandle = cardFieldIframes[2];
        const cardExpirationDateFrame = await cardExpirationDateFrameHandle.contentFrame();
        await cardExpirationDateFrame.waitForSelector(
            creditCardExpirationDateSelector
        );
        await cardExpirationDateFrame.type(
            creditCardExpirationDateSelector,
            cardDetails.expirationMonth + cardDetails.expirationYear,
            {
                delay: 10
            }
        );
        await page.waitForTimeout(2000);

        const cardCVVFrameHandle = cardFieldIframes[3];
        const cardCVVFrame = await cardCVVFrameHandle.contentFrame();
        await cardCVVFrame.type(creditCardCVVSelector, cardDetails.securityCode, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        // some sites do not require billing address or do not allow a different billing address from shipping address
        try {
            await page.waitForSelector(differentBillingAddressSelector);
            await page.click(differentBillingAddressSelector);
            await page.waitForTimeout(2000);

            await enterAddressDetails(page, billingAddress, 'billing');
        } catch (err) {
            // no-op if timeout occurs
        }

        await page.waitForSelector(submitButtonsSelector);
        await page.click(submitButtonsSelector);
        await page.waitForTimeout(5000);

        await page.goto(`${domain}/checkout`, { waitUntil: 'networkidle0' })
        if (page.url() === `${domain}/cart`) {
            checkoutComplete = true;
        }

        return { hasCaptcha, checkoutComplete }
    } catch (err) {
        console.error(err);
        throw new Error(err.message);
    }
}

async function enterAddressDetails(page, address, type) {
    try {
        const firstNameSelector = `input#checkout_${type}_address_first_name`;
        const lastNameSelector = `input#checkout_${type}_address_last_name`;
        const address1Selector = `input#checkout_${type}_address_address1`;
        const address2Selector = `input#checkout_${type}_address_address2`;
        const citySelector = `input#checkout_${type}_address_city`;
        const stateSelector = `select#checkout_${type}_address_province`;
        const postalCodeSelector = `input#checkout_${type}_address_zip`;
        const phoneNumberSelector = `input#checkout_${type}_address_phone`;

        await page.waitForSelector(firstNameSelector);
        await page.type(firstNameSelector, address.first_name, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await page.waitForSelector(lastNameSelector);
        await page.type(lastNameSelector, address.last_name, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await page.waitForSelector(address1Selector);
        await page.type(address1Selector, address.address_line_1, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await page.waitForSelector(address2Selector);
        await page.type(address2Selector, address.address_line_2, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await page.waitForSelector(citySelector);
        await page.type(citySelector, address.city, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await page.waitForSelector(stateSelector);
        await page.select(stateSelector, address.state);
        await page.waitForTimeout(2000);

        await page.waitForSelector(postalCodeSelector);
        await page.type(postalCodeSelector, address.postal_code, {
            delay: 10
        });
        await page.waitForTimeout(2000);

        await page.waitForSelector(phoneNumberSelector);
        await page.type(phoneNumberSelector, 1 + address.phone_number, {
            delay: 10
        });
        await page.waitForTimeout(2000);
    } catch (err) {
        console.error(err);
        throw new Error(err.message);
    }
}
