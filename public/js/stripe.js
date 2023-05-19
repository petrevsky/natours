/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const bookTour = async tourId => {
    const stripe = Stripe(
        'pk_test_51N8nHXLwFOA2EB2ILl9ImLaXPnjxURQCBZKD3GuwHQxAwZ1b5T5FAm75qb3lMItFOcStTuhqMYdEmvtZcupEaAJy00E7trHtJE'
    );
    try {
        // 1) Get checkout session from API

        const session = await axios(
            `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
        );

        console.log(session);
        await stripe.redirectToCheckout({
            sessionId: session.data.session.id,
        });

        // 2) Create checkout form + charge credit card
    } catch (err) {
        console.log(err);
        showAlert('error', err.message);
    }
};
